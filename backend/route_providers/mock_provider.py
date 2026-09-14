import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


FIXTURE_PATH = (
    Path(__file__).parent.parent / "fixtures" / "transit_guidance_plan_demo.json"
)
JAPAN_TIMEZONE = ZoneInfo("Asia/Tokyo")

# The fixture's query condition. Its route arrives at 09:57, before this time.
FIXTURE_DESIRED_ARRIVAL_AT = datetime(
    2026,
    8,
    25,
    10,
    12,
    tzinfo=JAPAN_TIMEZONE,
)


def get_route(
    _origin,
    _destination,
    arrival_at,
    origin_display_name=None,
    destination_display_name=None,
    origin_place_types=None,
    destination_place_types=None,
):
    """Transit形式のデモfixtureを到着希望日時に合わせて返す。"""
    with FIXTURE_PATH.open(encoding="utf-8") as fixture_file:
        response_data = json.load(fixture_file)

    requested_arrival_at = _as_japan_datetime(arrival_at)
    time_difference_seconds = (
        requested_arrival_at - FIXTURE_DESIRED_ARRIVAL_AT
    ).total_seconds()
    _shift_service_seconds(response_data, time_difference_seconds)
    return response_data


def _as_japan_datetime(value):
    if not isinstance(value, datetime):
        raise ValueError("到着希望日時がdatetimeではありません")
    if value.tzinfo is None:
        return value.replace(tzinfo=JAPAN_TIMEZONE)
    return value.astimezone(JAPAN_TIMEZONE)


def _shift_service_seconds(value, difference_seconds):
    if isinstance(value, list):
        for item in value:
            _shift_service_seconds(item, difference_seconds)
        return

    if not isinstance(value, dict):
        return

    for key in ("departureSecs", "arrivalSecs"):
        seconds = value.get(key)
        if isinstance(seconds, (int, float)) and not isinstance(seconds, bool):
            value[key] = seconds + difference_seconds

    for child_value in value.values():
        _shift_service_seconds(child_value, difference_seconds)
