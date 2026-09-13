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
    TransitTimeoutError,
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


class RouteProviderTimeoutError(RoutesServiceError):
    """Route Providerの経路検索がタイムアウトした。"""


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
    except TransitTimeoutError as error:
        raise RouteProviderTimeoutError(str(error)) from error
    except TransitProviderError as error:
        raise RouteProviderError(str(error)) from error
    except (OSError, ValueError, NotImplementedError) as error:
        raise RouteProviderError(str(error)) from error

    return convert_transit_routes(
        response_data,
        origin_display_name or origin,
        destination_display_name or destination,
    )


def convert_transit_routes(response_data, origin, destination):
    """Transit guidance-plan optionsを共通Route candidate一覧へ変換する。"""
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

    service_midnight = _get_service_midnight(response_data)
    candidates = []
    candidate_options = []
    for option in options[:3]:
        if not isinstance(option, dict):
            raise RoutesResponseError("Transit guidance planのoption形式が不正です")

        candidate = _convert_transit_option(
            option,
            service_midnight,
            origin,
            destination,
        )
        if candidate is None:
            continue

        candidate["candidate_id"] = f"candidate-{len(candidates) + 1}"
        candidates.append(candidate)
        candidate_options.append(option)

    if not candidates:
        raise RouteNotFoundError("公共交通を使う経路が見つかりませんでした")

    recommended_index = _recommended_candidate_index(
        response_data,
        candidate_options,
    )
    return {
        "candidates": candidates,
        "recommended_candidate_id": candidates[recommended_index]["candidate_id"],
        "warnings": _convert_coverage_warnings(response_data),
    }


def _convert_transit_option(option, service_midnight, origin, destination):
    journey = option.get("journey")
    if not isinstance(journey, dict):
        raise RoutesResponseError("Transit guidance planにjourneyがありません")

    raw_legs = journey.get("legs")
    if not isinstance(raw_legs, list):
        raise RoutesResponseError("Transit journeyのlegs形式が不正です")

    has_transit_leg = any(
        isinstance(leg, dict) and leg.get("kind") == "transit"
        for leg in raw_legs
    )
    if not has_transit_leg and all(
        isinstance(leg, dict) and leg.get("kind") == "walk"
        for leg in raw_legs
    ):
        return None

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

    parsed_legs = [
        _convert_transit_leg(leg, service_midnight)
        for leg in raw_legs
    ]
    if not any(leg["type"] == "TRANSIT" for leg in parsed_legs):
        return None

    metrics = option.get("metrics")
    if metrics is None:
        metrics = {}
    if not isinstance(metrics, dict):
        raise RoutesResponseError("Transit optionのmetrics形式が不正です")

    transfer_count = _optional_integer_field(
        metrics,
        "transferCount",
        "optionの乗換回数",
    )
    if transfer_count is None:
        transfer_count = _optional_integer_field(
            journey,
            "transferCount",
            "journeyの乗換回数",
        )

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
        "transfer_count": transfer_count,
        "walk_minutes": _optional_minutes_field(
            metrics,
            "walkSecs",
            "optionの徒歩時間",
        ),
        "wait_minutes": _optional_minutes_field(
            metrics,
            "waitSecs",
            "optionの待ち時間",
        ),
        "fare": _convert_fare(
            metrics.get("fare")
            if metrics.get("fare") is not None
            else journey.get("fare")
        ),
        "segments": parsed_legs,
    }


def _convert_transit_leg(leg, service_midnight):
    if not isinstance(leg, dict):
        raise RoutesResponseError("Transit leg形式が不正です")

    kind = leg.get("kind")
    if kind == "walk":
        segment_type = "WALK"
        line_name = None
        mode = None
    elif kind == "transit":
        segment_type = "TRANSIT"
        line_name = leg.get("routeName")
        if not isinstance(line_name, str) or not line_name.strip():
            raise RoutesResponseError("Transit legに路線表示名がありません")
        line_name = line_name.strip()
        mode = _optional_string_field(leg, "mode", "legの交通モード")
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
        "mode": mode,
        "train_type": (
            _optional_string_field(leg, "trainType", "legの列車種別")
            if segment_type == "TRANSIT"
            else None
        ),
        "headsign": (
            _optional_string_field(leg, "headsign", "legの行先")
            if segment_type == "TRANSIT"
            else None
        ),
        "from_platform": (
            _endpoint_platform(leg.get("from"), "from")
            if segment_type == "TRANSIT"
            else None
        ),
        "to_platform": (
            _endpoint_platform(leg.get("to"), "to")
            if segment_type == "TRANSIT"
            else None
        ),
        "color": (
            _optional_string_field(leg, "color", "legの路線色")
            if segment_type == "TRANSIT"
            else None
        ),
        "headway_based": (
            _optional_boolean_field(leg, "headwayBased", "legの運転間隔情報")
            if segment_type == "TRANSIT"
            else None
        ),
    }


def _recommended_candidate_index(response_data, candidate_options):
    decision = response_data.get("decision")
    recommended_option_id = (
        decision.get("recommendedOptionId")
        if isinstance(decision, dict)
        else None
    )
    if isinstance(recommended_option_id, str):
        for index, option in enumerate(candidate_options):
            if option.get("id") == recommended_option_id:
                return index

    for index, option in enumerate(candidate_options):
        if option.get("recommended") is True:
            return index
    return 0


COVERAGE_WARNING_MESSAGES = {
    "loadedDataScope": "利用できる交通データの範囲が限られているため、候補が限られる場合があります。",
    "stationRailCandidateMissing": "近隣の鉄道駅候補を特定できず、経路が限られている場合があります。",
    "noRouteInLoadedData": "読み込み済みの交通データでは経路を十分に確認できない場合があります。",
    "constraintsApplied": "検索条件の影響で候補が限られている場合があります。",
    "constraintsNoRoute": "適用された検索条件では経路が見つからない場合があります。",
    "staleFeedData": "時刻表データが古く、実際の運行と異なる場合があります。",
}


def _convert_coverage_warnings(response_data):
    coverage = response_data.get("coverage")
    notices = coverage.get("notices") if isinstance(coverage, dict) else None
    if not isinstance(notices, list):
        return []

    warnings = []
    for notice in notices:
        if not isinstance(notice, dict) or notice.get("severity") != "warning":
            continue
        code = notice.get("code")
        if not isinstance(code, str):
            continue
        message = COVERAGE_WARNING_MESSAGES.get(code)
        if message and message not in warnings:
            warnings.append(message)
    return warnings


def _convert_fare(fare):
    if fare is None:
        return None
    if not isinstance(fare, dict):
        raise RoutesResponseError("Transit fare形式が不正です")

    return {
        "currency": _optional_string_field(fare, "currency", "fareの通貨"),
        "ticket": _optional_fare_amount(fare, "ticket"),
        "ic": _optional_fare_amount(fare, "ic"),
    }


def _optional_fare_amount(value, field_name):
    amount = value.get(field_name)
    if amount is None:
        return None
    if (
        isinstance(amount, bool)
        or not isinstance(amount, (int, float))
        or not math.isfinite(amount)
        or amount < 0
    ):
        raise RoutesResponseError(f"Transit fareの{field_name}形式が不正です")
    return amount


def _optional_minutes_field(value, field_name, description):
    seconds = _optional_number_field(value, field_name, description)
    if seconds is None:
        return None
    if seconds < 0:
        raise RoutesResponseError(f"Transit {description}が負の値です")
    return _seconds_to_minutes(seconds)


def _optional_integer_field(value, field_name, description):
    number = _optional_number_field(value, field_name, description)
    if number is None:
        return None
    if number < 0 or not float(number).is_integer():
        raise RoutesResponseError(f"Transit {description}の形式が不正です")
    return int(number)


def _optional_number_field(value, field_name, description):
    number = value.get(field_name)
    if number is None:
        return None
    if (
        isinstance(number, bool)
        or not isinstance(number, (int, float))
        or not math.isfinite(number)
    ):
        raise RoutesResponseError(f"Transit {description}の形式が不正です")
    return number


def _optional_string_field(value, field_name, description):
    string = value.get(field_name)
    if string is None:
        return None
    if not isinstance(string, str):
        raise RoutesResponseError(f"Transit {description}の形式が不正です")
    return string.strip() or None


def _optional_boolean_field(value, field_name, description):
    boolean = value.get(field_name)
    if boolean is None:
        return None
    if not isinstance(boolean, bool):
        raise RoutesResponseError(f"Transit {description}の形式が不正です")
    return boolean


def _endpoint_platform(endpoint, field_name):
    if not isinstance(endpoint, dict):
        raise RoutesResponseError(f"Transit legの{field_name}地点がありません")
    return _optional_string_field(
        endpoint,
        "platformCode",
        f"{field_name}地点のplatform",
    )


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
