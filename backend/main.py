import logging
import os
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
    start_at: str
    location_name: str | None = None
    destination: str | None = None
    destination_lat: float | None = None
    destination_lng: float | None = None
    destination_place_types: list[str] | None = None
    arrival_buffer_minutes: int | None = None


class DirectRouteSearchRequest(RouteSearchRequest):
    event: RouteSearchEvent


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
    event = request.event
    origin_name = clean_optional_text(request.origin_name)
    origin_address = clean_optional_text(request.origin_address)
    origin_coordinates = format_route_coordinates(
        request.origin_lat,
        request.origin_lng,
    )
    origin = origin_coordinates or origin_address or origin_name
    if not origin:
        raise HTTPException(
            status_code=400,
            detail="出発地として利用できる情報を入力してください",
        )
    origin_display_name = origin_name or origin_address or origin

    destination_address = clean_optional_text(event.destination)
    destination_location_name = clean_optional_text(event.location_name)
    destination_coordinates = format_route_coordinates(
        event.destination_lat,
        event.destination_lng,
    )
    destination = (
        destination_coordinates
        or destination_address
        or destination_location_name
    )
    if not destination:
        raise HTTPException(status_code=400, detail="予定に目的地が設定されていません")
    destination_display_name = (
        destination_location_name or destination_address or destination
    )

    try:
        event_start = datetime.strptime(event.start_at, "%Y-%m-%dT%H:%M")
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail="予定の開始日時が不正です",
        ) from error

    desired_arrival_at = event_start - timedelta(
        minutes=event.arrival_buffer_minutes or 0,
    )

    try:
        return search_route(
            origin,
            destination,
            desired_arrival_at,
            origin_display_name=origin_display_name,
            destination_display_name=destination_display_name,
            origin_place_types=request.origin_place_types,
            destination_place_types=event.destination_place_types,
        )
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
