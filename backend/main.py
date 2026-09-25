import logging
import os
import re
from datetime import datetime, timedelta
from time import perf_counter

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from routes_service import (
    RouteEndpointResolutionError,
    RouteNotFoundError,
    RouteProviderTimeoutError,
    RoutesServiceError,
    search_route,
)
from route_providers.transit_provider import TransitHttpError


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
logger = logging.getLogger(__name__)

# HTTP client INFO logs include request URLs and may expose location query
# parameters. Route-search diagnostics must remain location-free.
for _http_client_logger_name in ("httpx", "httpcore"):
    logging.getLogger(_http_client_logger_name).setLevel(logging.WARNING)


class _SafeLoggedException(Exception):
    """Cause types and tracebacks for logs without raw exception messages."""


def get_cors_origins():
    cors_origins_text = os.getenv("CORS_ORIGINS", "")
    cors_origins = [
        origin.strip()
        for origin in cors_origins_text.split(",")
        if origin.strip()
    ]
    return cors_origins or DEFAULT_CORS_ORIGINS


app = FastAPI(title="PlanRail")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class RouteSearchRequest(BaseModel):
    origin_name: str | None = None
    origin_address: str | None = None
    origin_place_id: str | None = None
    origin_lat: float | None = None
    origin_lng: float | None = None
    origin_place_types: list[str] | None = None


class RouteSearchEvent(BaseModel):
    start_at: str | None = None
    location_name: str | None = None
    destination: str | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    destination_place_types: list[str] | None = None
    arrival_buffer_minutes: int | None = None


class RoutePlacePoint(BaseModel):
    name: str = ""
    address: str | None = None
    place_id: str | None = None
    lat: float | None = None
    lng: float | None = None
    types: list[str] = Field(default_factory=list)


class DirectRouteSearchRequest(RouteSearchRequest):
    event: RouteSearchEvent | None = None
    origin: RoutePlacePoint | None = None
    destination: RoutePlacePoint | None = None
    destination_name: str | None = None
    destination_address: str | None = None
    destination_place_id: str | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    destination_place_types: list[str] | None = None
    time_constraint: dict | None = None


class RouteFare(BaseModel):
    currency: str | None = None
    ticket: int | float | None = None
    ic: int | float | None = None


class RouteSegment(BaseModel):
    type: str
    from_: str = Field(alias="from")
    to: str
    departure_at: str
    arrival_at: str
    duration_minutes: int = Field(ge=0)
    line_name: str | None = None
    mode: str | None = None
    train_type: str | None = None
    headsign: str | None = None
    from_platform: str | None = None
    to_platform: str | None = None
    color: str | None = None
    headway_based: bool | None = None


class RouteCandidate(BaseModel):
    candidate_id: str
    origin: str
    destination: str
    departure_at: str
    arrival_at: str
    duration_minutes: int = Field(ge=0)
    transport_mode: str
    transfer_count: int | None = Field(default=None, ge=0)
    walk_minutes: int | None = Field(default=None, ge=0)
    wait_minutes: int | None = Field(default=None, ge=0)
    fare: RouteFare | None = None
    segments: list[RouteSegment]


class RouteSearchResponse(BaseModel):
    candidates: list[RouteCandidate] = Field(min_length=1, max_length=3)
    recommended_candidate_id: str
    warnings: list[str]


def clean_optional_text(value):
    if value is None:
        return ""
    return value.strip()


def format_route_coordinates(latitude, longitude):
    if latitude is None or longitude is None:
        return ""
    return f"{latitude},{longitude}"


def transit_http_status_code(error):
    current = error
    seen = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, TransitHttpError):
            return current.status_code
        current = current.__cause__ or current.__context__
    return None


def log_route_search_failure(error, response_status):
    safe_error = safe_exception_chain(error)
    try:
        raise safe_error
    except _SafeLoggedException:
        logger.exception(
            "POST /api/route-search failed; service_error=%s response_status=%s "
            "transit_http_status_code=%s",
            type(error).__name__,
            response_status,
            transit_http_status_code(error),
        )


def safe_exception_chain(error):
    """Keep cause types and traceback frames while omitting exception messages."""
    safe_error = _SafeLoggedException(type(error).__name__)
    safe_error.__traceback__ = error.__traceback__
    safe_error.__suppress_context__ = True
    cause = error.__cause__ or error.__context__
    if cause is not None:
        safe_error.__cause__ = safe_exception_chain(cause)
    return safe_error


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post(
    "/api/route-search",
    response_model=RouteSearchResponse,
)
def search_direct_route(request: DirectRouteSearchRequest):
    search_started = perf_counter()
    try:
        return _search_direct_route(request)
    finally:
        logger.info(
            "route_search_stage=total elapsed_ms=%.3f",
            (perf_counter() - search_started) * 1000,
        )


def _search_direct_route(request: DirectRouteSearchRequest):
    if request.event is None and request.time_constraint is None:
        raise HTTPException(status_code=400, detail="時間制約を指定してください")

    event = request.event
    origin_name = clean_optional_text(
        request.origin.name if request.origin is not None else request.origin_name
    )
    origin_address = clean_optional_text(
        request.origin.address if request.origin is not None else request.origin_address
    )
    origin_coordinates = format_route_coordinates(
        request.origin.lat if request.origin is not None else request.origin_lat,
        request.origin.lng if request.origin is not None else request.origin_lng,
    )
    if not origin_coordinates:
        raise HTTPException(
            status_code=400,
            detail="出発地として利用できるGoogle Places候補を選択してください",
        )
    origin = origin_coordinates or origin_address or origin_name
    if not origin:
        raise HTTPException(
            status_code=400,
            detail="出発地として利用できる情報を入力してください",
        )
    origin_display_name = origin_name or origin_address or origin

    destination_address = clean_optional_text(
        event.destination
        if event is not None
        else (request.destination.address if request.destination is not None else request.destination_address)
    )
    destination_location_name = clean_optional_text(
        event.location_name
        if event is not None
        else (request.destination.name if request.destination is not None else request.destination_name)
    )
    destination_coordinates = format_route_coordinates(
        event.destination_lat
        if event is not None
        else (request.destination.lat if request.destination is not None else request.destination_lat),
        event.destination_lng
        if event is not None
        else (request.destination.lng if request.destination is not None else request.destination_lng),
    )
    if not destination_coordinates:
        raise HTTPException(
            status_code=400,
            detail="経路検索には予定の目的地をPlaces候補から選択してください",
        )
    destination = (
        destination_coordinates
        or destination_address
        or destination_location_name
    )
    if not destination:
        raise HTTPException(status_code=400, detail="予定に目的地が設定されていません")
    destination_display_name = destination_location_name or destination_address or destination

    constraint = {}
    if event is not None:
        if not event.start_at:
            raise HTTPException(status_code=400, detail="予定の開始日時が不正です")
        try:
            event_start = datetime.strptime(event.start_at, "%Y-%m-%dT%H:%M")
        except ValueError as error:
            raise HTTPException(status_code=400, detail="予定の開始日時が不正です") from error
        desired_arrival_at = event_start - timedelta(minutes=event.arrival_buffer_minutes or 0)
        constraint_type = "arrival"
        destination_types = event.destination_place_types
    else:
        constraint = request.time_constraint or {}
        constraint_type = constraint.get("type")
        constraint_at = constraint.get("at")
        if constraint_type not in {"arrival", "departure"}:
            raise HTTPException(status_code=400, detail="時間制約の種類が不正です")
        if not isinstance(constraint_at, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", constraint_at):
            raise HTTPException(status_code=400, detail="時間制約の日時が不正です")
        try:
            desired_arrival_at = datetime.strptime(constraint_at, "%Y-%m-%dT%H:%M")
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=400, detail="時間制約の日時が不正です") from error
        latest_arrival_at = constraint.get("latest_arrival_at")
        if latest_arrival_at is not None:
            if not isinstance(latest_arrival_at, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", latest_arrival_at):
                raise HTTPException(status_code=400, detail="到着上限の日時が不正です")
            try:
                latest_arrival = datetime.strptime(latest_arrival_at, "%Y-%m-%dT%H:%M")
            except (TypeError, ValueError) as error:
                raise HTTPException(status_code=400, detail="到着上限の日時が不正です") from error
            if latest_arrival < desired_arrival_at and constraint_type == "departure":
                raise HTTPException(status_code=400, detail="到着上限は出発時刻以降にしてください")
        destination_types = (
            request.destination.types
            if request.destination is not None
            else request.destination_place_types
        )

    origin_types = (
        request.origin.types if request.origin is not None else request.origin_place_types
    )

    try:
        result = search_route(
            origin,
            destination,
            desired_arrival_at,
            constraint_type=constraint_type,
            origin_display_name=origin_display_name,
            destination_display_name=destination_display_name,
            origin_place_types=origin_types,
            destination_place_types=destination_types,
        )
        if constraint:
            constraint_at = constraint["at"]
            candidates = result.get("candidates", [])
            if constraint_type == "arrival":
                candidates = [
                    candidate
                    for candidate in candidates
                    if candidate.get("arrival_at") and candidate["arrival_at"] <= constraint_at
                ]
            else:
                candidates = [
                    candidate
                    for candidate in candidates
                    if candidate.get("departure_at") and candidate["departure_at"] >= constraint_at
                ]
            latest_arrival_at = constraint.get("latest_arrival_at")
            if latest_arrival_at:
                candidates = [
                    candidate
                    for candidate in candidates
                    if candidate.get("arrival_at") and candidate["arrival_at"] <= latest_arrival_at
                ]
            result["candidates"] = candidates
            if not result["candidates"]:
                raise HTTPException(status_code=404, detail="時間条件を満たす経路が見つかりませんでした")
            result["recommended_candidate_id"] = result["candidates"][0]["candidate_id"]
        return result
    except RouteNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except RouteEndpointResolutionError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
    except RouteProviderTimeoutError as error:
        log_route_search_failure(error, 504)
        raise HTTPException(
            status_code=504,
            detail="経路検索に時間がかかりすぎました。もう一度お試しください。",
        ) from error
    except RoutesServiceError as error:
        log_route_search_failure(error, 502)
        raise HTTPException(
            status_code=502,
            detail="経路検索サービスとの通信に失敗しました",
        ) from error
