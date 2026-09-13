import math
import os
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv

from route_providers import get_route_provider
from route_providers.transit_provider import (
    TransitEndpointResolutionError,
    TransitProviderError,
)


load_dotenv(Path(__file__).with_name(".env"))

DEFAULT_ROUTE_PROVIDER = "transit"
JAPAN_TIMEZONE = ZoneInfo("Asia/Tokyo")


class RoutesServiceError(Exception):
    """経路検索サービスで発生したエラーの基底クラス。"""


class RouteEndpointResolutionError(RoutesServiceError):
    """地点を経路検索用endpointへ解決できなかった。"""


class RouteNotFoundError(RoutesServiceError):
    """公共交通を使う経路が見つからなかった。"""


class RoutesResponseError(RoutesServiceError):
    """外部サービスのレスポンスをRoute形式へ変換できなかった。"""


class RouteProviderError(RoutesServiceError):
    """Route Providerの設定またはデータ取得に失敗した。"""


def search_route(
    origin,
    destination,
    arrival_at,
    provider_name=None,
    origin_display_name=None,
    destination_display_name=None,
):
    """設定されたProviderからTransit形式データを取得して変換する。"""
    selected_provider = (
        provider_name or os.getenv("ROUTE_PROVIDER", DEFAULT_ROUTE_PROVIDER)
    ).strip().lower()

    try:
        provider = get_route_provider(selected_provider)
        response_data = provider(
            origin,
            destination,
            arrival_at,
            origin_display_name=origin_display_name,
            destination_display_name=destination_display_name,
        )
    except TransitEndpointResolutionError as error:
        raise RouteEndpointResolutionError(str(error)) from error
    except TransitProviderError as error:
        raise RouteProviderError(str(error)) from error
    except (OSError, ValueError, NotImplementedError) as error:
        raise RouteProviderError(str(error)) from error

    return convert_transit_route(
        response_data,
        origin_display_name or origin,
        destination_display_name or destination,
    )


def convert_transit_route(response_data, origin, destination):
    """Transit guidance-planの1候補を共通Route JSONへ変換する。"""
    if not isinstance(response_data, dict):
        raise RoutesResponseError(
            "Transit guidance planのレスポンスがJSONオブジェクトではありません"
        )

    options = response_data.get("options")
    if not isinstance(options, list):
        raise RoutesResponseError(
            "Transit guidance planのoptions形式が不正です"
        )
    if not options:
        raise RouteNotFoundError("公共交通を使う経路が見つかりませんでした")

    option = options[0]
    if not isinstance(option, dict):
        raise RoutesResponseError("Transit guidance planのoption形式が不正です")
    journey = option.get("journey")
    if not isinstance(journey, dict):
        raise RoutesResponseError("Transit guidance planにjourneyがありません")

    service_midnight = _get_service_midnight(response_data)
    route_departure_seconds = _number_field(
        journey,
        "departureSecs",
        "journeyの出発時刻",
    )
    route_arrival_seconds = _number_field(
        journey,
        "arrivalSecs",
        "journeyの到着時刻",
    )
    route_duration_seconds = _number_field(
        journey,
        "durationSecs",
        "journeyの所要時間",
    )
    if route_arrival_seconds < route_departure_seconds:
        raise RoutesResponseError("Transit journeyの到着が出発より前です")
    if route_duration_seconds < 0:
        raise RoutesResponseError("Transit journeyの所要時間が負の値です")

    raw_legs = journey.get("legs")
    if not isinstance(raw_legs, list):
        raise RoutesResponseError("Transit journeyのlegs形式が不正です")

    parsed_legs = [
        _convert_transit_leg(leg, service_midnight)
        for leg in raw_legs
    ]
    if not any(leg["type"] == "TRANSIT" for leg in parsed_legs):
        raise RouteNotFoundError("公共交通を使う経路が見つかりませんでした")

    return {
        "origin": origin,
        "destination": destination,
        "departure_at": _format_app_datetime(
            _datetime_at_service_seconds(service_midnight, route_departure_seconds)
        ),
        "arrival_at": _format_app_datetime(
            _datetime_at_service_seconds(service_midnight, route_arrival_seconds)
        ),
        "duration_minutes": _seconds_to_minutes(route_duration_seconds),
        "transport_mode": "TRANSIT",
        "segments": parsed_legs,
    }


def _convert_transit_leg(leg, service_midnight):
    if not isinstance(leg, dict):
        raise RoutesResponseError("Transit leg形式が不正です")

    kind = leg.get("kind")
    if kind == "walk":
        segment_type = "WALK"
        line_name = None
    elif kind == "transit":
        segment_type = "TRANSIT"
        line_name = leg.get("routeName")
        if not isinstance(line_name, str) or not line_name.strip():
            raise RoutesResponseError("Transit legに路線表示名がありません")
        line_name = line_name.strip()
    else:
        raise RoutesResponseError("Transit legのkindが不正です")

    from_name = _leg_endpoint_name(leg.get("from"), "from")
    to_name = _leg_endpoint_name(leg.get("to"), "to")
    departure_seconds = _number_field(
        leg,
        "departureSecs",
        "legの出発時刻",
    )
    arrival_seconds = _number_field(
        leg,
        "arrivalSecs",
        "legの到着時刻",
    )
    if arrival_seconds < departure_seconds:
        raise RoutesResponseError("Transit legの到着が出発より前です")

    duration_seconds = arrival_seconds - departure_seconds
    return {
        "type": segment_type,
        "from": from_name,
        "to": to_name,
        "departure_at": _format_app_datetime(
            _datetime_at_service_seconds(service_midnight, departure_seconds)
        ),
        "arrival_at": _format_app_datetime(
            _datetime_at_service_seconds(service_midnight, arrival_seconds)
        ),
        "duration_minutes": _seconds_to_minutes(duration_seconds),
        "line_name": line_name,
    }


def _get_service_midnight(response_data):
    service_date_text = response_data.get("date")
    timezone_name = response_data.get("timezone")
    if not isinstance(service_date_text, str) or not service_date_text:
        raise RoutesResponseError("Transit responseにservice dateがありません")
    if not isinstance(timezone_name, str) or not timezone_name:
        raise RoutesResponseError("Transit responseにtimezoneがありません")

    try:
        if len(service_date_text) == 8 and service_date_text.isdigit():
            service_date = datetime.strptime(
                service_date_text,
                "%Y%m%d",
            ).date()
        else:
            service_date = date.fromisoformat(service_date_text)
        service_timezone = ZoneInfo(timezone_name)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise RoutesResponseError(
            "Transit responseのservice dateまたはtimezoneが不正です"
        ) from error

    return datetime.combine(service_date, time.min).replace(
        tzinfo=service_timezone
    )


def _leg_endpoint_name(endpoint, field_name):
    if not isinstance(endpoint, dict):
        raise RoutesResponseError(f"Transit legの{field_name}地点がありません")
    name = endpoint.get("name")
    if not isinstance(name, str) or not name.strip():
        raise RoutesResponseError(
            f"Transit legの{field_name}地点名が不正です"
        )
    return name


def _number_field(value, field_name, description):
    number = value.get(field_name)
    if (
        isinstance(number, bool)
        or not isinstance(number, (int, float))
        or not math.isfinite(number)
    ):
        raise RoutesResponseError(f"Transit {description}の形式が不正です")
    return number


def _format_app_datetime(value):
    return value.astimezone(JAPAN_TIMEZONE).strftime("%Y-%m-%dT%H:%M")


def _datetime_at_service_seconds(service_midnight, seconds):
    try:
        return service_midnight + timedelta(seconds=seconds)
    except (OverflowError, ValueError) as error:
        raise RoutesResponseError(
            "Transit responseの時刻がサポート範囲外です"
        ) from error


def _seconds_to_minutes(seconds):
    return math.ceil(seconds / 60)
