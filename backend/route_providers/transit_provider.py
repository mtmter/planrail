import math
import unicodedata
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx


TRANSIT_API_BASE_URL = "https://api.transit.ls8h.com"
GUIDANCE_PLAN_URL = f"{TRANSIT_API_BASE_URL}/api/v1/guidance/plan"
PLACES_REVERSE_URL = f"{TRANSIT_API_BASE_URL}/api/v1/places/reverse"
REQUEST_TIMEOUT_SECONDS = 10.0
JAPAN_TIMEZONE = ZoneInfo("Asia/Tokyo")
STATION_REVERSE_RADIUS_METERS = 300
STATION_REVERSE_LIMIT = 10
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
    origin_display_name=None,
    destination_display_name=None,
):
    """Transit APIで到着時刻を指定した経路候補を取得する。"""
    # Validate both endpoints before any optional reverse-lookup request.
    if _parse_coordinates(origin) is None or _parse_coordinates(destination) is None:
        raise TransitEndpointResolutionError(
            "出発地または目的地の位置情報を解決できませんでした。"
            "Google Placesの候補を選択してください"
        )
    origin_endpoint = resolve_planner_endpoint(origin, origin_display_name)
    destination_endpoint = resolve_planner_endpoint(
        destination,
        destination_display_name,
    )
    arrival_datetime = _as_japan_datetime(arrival_at)

    query_parameters = {
        "from": origin_endpoint,
        "to": destination_endpoint,
        "date": arrival_datetime.strftime("%Y%m%d"),
        "time": arrival_datetime.strftime("%H:%M"),
        "type": "arrival",
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

    response_data = _request_json(
        GUIDANCE_PLAN_URL,
        query_parameters,
        operation="Transit guidance plan",
    )
    if not isinstance(response_data, dict):
        raise TransitResponseError(
            "Transit guidance planのレスポンスがJSONオブジェクトではありません"
        )
    return response_data


def resolve_planner_endpoint(location, display_name=None):
    """座標地点を駅/停留所endpointまたはgeo endpointへ解決する。"""
    coordinates = _parse_coordinates(location)
    if coordinates is None:
        raise TransitEndpointResolutionError(
            "出発地または目的地の位置情報を解決できませんでした。"
            "Google Placesの候補を選択してください"
        )

    latitude, longitude = coordinates
    label = display_name.strip() if isinstance(display_name, str) else ""
    if label:
        try:
            station_endpoint = _find_matching_station(
                latitude,
                longitude,
                label,
            )
        except TransitProviderError:
            # Reverse lookup is an optional precision improvement. Planning can
            # continue with the geographic endpoint when it is unavailable.
            station_endpoint = None
        if station_endpoint:
            return station_endpoint

    return f"geo:{latitude},{longitude}"


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
            matches.append((float(distance), endpoint))

    if not matches:
        return None
    matches.sort(key=lambda candidate: candidate[0])
    return matches[0][1]


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


def _request_json(url, parameters, operation):
    try:
        response = httpx.get(
            url,
            params=parameters,
            timeout=REQUEST_TIMEOUT_SECONDS,
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
