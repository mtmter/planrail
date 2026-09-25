import logging
import math
import unicodedata
from datetime import datetime, timedelta, timezone
from time import perf_counter
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx


TRANSIT_API_BASE_URL = "https://api.transit.ls8h.com"
GUIDANCE_PLAN_URL = f"{TRANSIT_API_BASE_URL}/api/v1/guidance/plan"
PLACES_REVERSE_URL = f"{TRANSIT_API_BASE_URL}/api/v1/places/reverse"
GUIDANCE_PLAN_TIMEOUT_SECONDS = 45.0
REVERSE_LOOKUP_TIMEOUT_SECONDS = 10.0
JAPAN_TIMEZONE = ZoneInfo("Asia/Tokyo")
STATION_REVERSE_RADIUS_METERS = 300
STATION_REVERSE_LIMIT = 10
PUBLIC_TRANSPORT_PLACE_TYPES = frozenset(
    {
        "train_station",
        "subway_station",
        "transit_station",
        "bus_station",
        "bus_stop",
        "light_rail_station",
        "transit_stop",
    }
)
logger = logging.getLogger(__name__)
LOCATION_SUFFIXES = (
    "busstop",
    "停留所",
    "バス停",
    "station",
    "駅",
    "stop",
)


class TransitProviderError(Exception):
    """Transit APIとの通信またはデータ処理で発生したエラー。"""


class TransitTimeoutError(TransitProviderError):
    """Transit APIとの通信がタイムアウトした。"""


class TransitConnectionError(TransitProviderError):
    """Transit APIへ接続できなかった。"""


class TransitHttpError(TransitProviderError):
    """Transit APIがHTTPエラーを返した。"""

    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


class TransitResponseError(TransitProviderError):
    """Transit APIのJSONまたはレスポンス形式が不正だった。"""


class TransitEndpointResolutionError(TransitProviderError):
    """地点に座標またはTransit planner endpointがない。"""


def get_route(
    origin,
    destination,
    arrival_at,
    constraint_type="arrival",
    origin_display_name=None,
    destination_display_name=None,
    origin_place_types=None,
    destination_place_types=None,
):
    """Transit APIで到着時刻を指定した経路候補を取得する。"""
    # Validate both endpoints before any optional reverse-lookup request.
    if _parse_coordinates(origin) is None or _parse_coordinates(destination) is None:
        raise TransitEndpointResolutionError(
            "出発地または目的地の位置情報を解決できませんでした。"
            "Google Placesの候補を選択してください"
        )
    origin_endpoint = resolve_planner_endpoint(
        origin,
        origin_display_name,
        origin_place_types,
        endpoint_role="origin",
    )
    destination_endpoint = resolve_planner_endpoint(
        destination,
        destination_display_name,
        destination_place_types,
        endpoint_role="destination",
    )
    arrival_datetime = _as_japan_datetime(arrival_at)

    if constraint_type not in {"arrival", "departure"}:
        raise TransitResponseError("経路検索の時間制約が不正です")

    query_parameters = {
        "from": origin_endpoint,
        "to": destination_endpoint,
        "date": arrival_datetime.strftime("%Y%m%d"),
        "time": arrival_datetime.strftime("%H:%M"),
        "type": constraint_type,
        "numItineraries": "3",
        "strategy": "balanced",
        "live": "false",
        "tracking": "none",
    }
    origin_label = _api_label(origin_display_name)
    destination_label = _api_label(destination_display_name)
    if origin_label:
        query_parameters["fromLabel"] = origin_label
    if destination_label:
        query_parameters["toLabel"] = destination_label

    plan_started = perf_counter()
    try:
        response_data = _request_json(
            GUIDANCE_PLAN_URL,
            query_parameters,
            operation="Transit guidance plan",
            timeout_seconds=GUIDANCE_PLAN_TIMEOUT_SECONDS,
        )
    finally:
        logger.info(
            "route_search_stage=guidance_plan elapsed_ms=%.3f",
            (perf_counter() - plan_started) * 1000,
        )
    if not isinstance(response_data, dict):
        raise TransitResponseError(
            "Transit guidance planのレスポンスがJSONオブジェクトではありません"
        )
    return response_data


def resolve_planner_endpoint(
    location,
    display_name=None,
    place_types=None,
    endpoint_role="endpoint",
):
    """座標地点を駅/停留所endpointまたはgeo endpointへ解決する。"""
    resolution_started = perf_counter()
    coordinates = _parse_coordinates(location)
    if coordinates is None:
        raise TransitEndpointResolutionError(
            "出発地または目的地の位置情報を解決できませんでした。"
            "Google Placesの候補を選択してください"
        )

    latitude, longitude = coordinates
    label = display_name.strip() if isinstance(display_name, str) else ""
    reverse_lookup_performed = False
    endpoint_kind = "geo"
    endpoint = f"geo:{latitude},{longitude}"
    try:
        if label and _has_public_transport_type(place_types):
            reverse_lookup_performed = True
            try:
                station_match = _find_matching_station(
                    latitude,
                    longitude,
                    label,
                )
            except TransitProviderError:
                # Reverse lookup is an optional precision improvement. Planning can
                # continue with the geographic endpoint when it is unavailable.
                station_match = None
            if station_match:
                endpoint, endpoint_kind = station_match
        return endpoint
    finally:
        safe_endpoint_role = (
            endpoint_role
            if endpoint_role in {"origin", "destination"}
            else "endpoint"
        )
        logger.info(
            "route_search_stage=endpoint_resolution endpoint=%s elapsed_ms=%.3f "
            "endpoint_kind=%s reverse_lookup=%s",
            safe_endpoint_role,
            (perf_counter() - resolution_started) * 1000,
            endpoint_kind,
            reverse_lookup_performed,
        )


def _has_public_transport_type(place_types):
    if not isinstance(place_types, (list, tuple, set, frozenset)):
        return False
    return any(
        isinstance(place_type, str)
        and place_type in PUBLIC_TRANSPORT_PLACE_TYPES
        for place_type in place_types
    )


def _find_matching_station(latitude, longitude, display_name):
    response_data = _request_json(
        PLACES_REVERSE_URL,
        {
            "lat": latitude,
            "lon": longitude,
            "radiusMeters": STATION_REVERSE_RADIUS_METERS,
            "limit": STATION_REVERSE_LIMIT,
        },
        operation="Transit reverse places",
        timeout_seconds=REVERSE_LOOKUP_TIMEOUT_SECONDS,
    )
    if not isinstance(response_data, dict):
        raise TransitResponseError(
            "Transit reverse placesのレスポンス形式が不正です"
        )
    places = response_data.get("places")
    if not isinstance(places, list):
        raise TransitResponseError(
            "Transit reverse placesにplaces配列がありません"
        )

    normalized_display_name = normalize_place_name(display_name)
    if not normalized_display_name:
        return None

    matches = []
    for place in places:
        if not isinstance(place, dict):
            raise TransitResponseError(
                "Transit reverse placesの候補形式が不正です"
            )

        kind = place.get("kind")
        endpoint = place.get("endpoint")
        place_name = place.get("name")
        distance = place.get("distanceMeters")
        if (
            not isinstance(kind, str)
            or not isinstance(endpoint, str)
            or not isinstance(place_name, str)
            or isinstance(distance, bool)
            or not isinstance(distance, (int, float))
            or not math.isfinite(distance)
        ):
            raise TransitResponseError(
                "Transit reverse placesの候補形式が不正です"
            )

        endpoint = endpoint.strip()
        if (
            kind not in {"station", "stop"}
            or not endpoint
            or endpoint.lower().startswith("geo:")
            or distance < 0
            or distance > STATION_REVERSE_RADIUS_METERS
        ):
            continue

        if normalize_place_name(place_name) == normalized_display_name:
            matches.append((float(distance), endpoint, kind))

    if not matches:
        return None
    matches.sort(key=lambda candidate: candidate[0])
    return matches[0][1], matches[0][2]


def normalize_place_name(value):
    """NFKCと空白除去後、許可した地点種別suffixだけを除く。"""
    if not isinstance(value, str):
        return ""

    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = "".join(normalized.split())
    for suffix in LOCATION_SUFFIXES:
        if normalized.endswith(suffix) and len(normalized) > len(suffix):
            return normalized[: -len(suffix)]
    return normalized


def _parse_coordinates(location):
    if not isinstance(location, str):
        return None

    parts = location.split(",")
    if len(parts) != 2:
        return None
    try:
        latitude, longitude = (float(part.strip()) for part in parts)
    except ValueError:
        return None

    if (
        not math.isfinite(latitude)
        or not math.isfinite(longitude)
        or not -90 <= latitude <= 90
        or not -180 <= longitude <= 180
    ):
        raise TransitEndpointResolutionError(
            "出発地または目的地の座標が不正です。"
            "Google Placesの候補を選択してください"
        )
    return latitude, longitude


def _api_label(value):
    if not isinstance(value, str):
        return None
    label = value.strip()
    if not label:
        return None
    return label[:120]


def _request_json(url, parameters, operation, timeout_seconds):
    try:
        response = httpx.get(
            url,
            params=parameters,
            timeout=timeout_seconds,
        )
    except httpx.TimeoutException as error:
        raise TransitTimeoutError(f"{operation}がタイムアウトしました") from error
    except httpx.RequestError as error:
        raise TransitConnectionError(f"{operation}へ接続できませんでした") from error

    if not response.is_success:
        raise TransitHttpError(
            response.status_code,
            f"{operation}がHTTPエラーを返しました ({response.status_code})",
        )

    try:
        return response.json()
    except ValueError as error:
        raise TransitResponseError(
            f"{operation}のレスポンスがJSONではありません"
        ) from error


def _as_japan_datetime(value):
    if not isinstance(value, datetime):
        raise TransitResponseError("到着希望日時がdatetimeではありません")
    if value.tzinfo is None:
        return value.replace(tzinfo=JAPAN_TIMEZONE)
    return value.astimezone(JAPAN_TIMEZONE)
