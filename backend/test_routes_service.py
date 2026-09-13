import json
import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

import httpx

import routes_service
from route_providers import ROUTE_PROVIDERS, mock_provider, transit_provider


FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "transit_guidance_plan_demo.json"
)


def load_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def make_response(response_data=None, status_code=200, json_error=False):
    response = Mock()
    response.is_success = 200 <= status_code < 300
    response.status_code = status_code
    if json_error:
        response.json.side_effect = ValueError("invalid JSON")
    else:
        response.json.return_value = response_data
    return response


def reverse_payload(name, endpoint="demo:station", kind="station", distance=20):
    return {
        "places": [
            {
                "id": endpoint,
                "endpoint": endpoint,
                "name": name,
                "kind": kind,
                "source": "transit",
                "lat": 33.6,
                "lon": 130.2,
                "score": 1,
                "weight": 1,
                "distanceMeters": distance,
            }
        ],
        "coverage": {"sources": ["transit"], "kinds": [kind], "notices": []},
    }


class TransitRouteConverterTest(unittest.TestCase):
    def test_mock_fixture_uses_transit_converter_and_common_route_shape(self):
        result = routes_service.search_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 25, 10, 12),
            provider_name="mock",
            origin_display_name="九州大学 伊都キャンパス",
            destination_display_name="Garraway F",
        )

        self.assertEqual(result["origin"], "九州大学 伊都キャンパス")
        self.assertEqual(result["destination"], "Garraway F")
        self.assertEqual(result["departure_at"], "2026-08-25T08:54")
        self.assertEqual(result["arrival_at"], "2026-08-25T09:57")
        self.assertEqual(result["duration_minutes"], 63)
        self.assertEqual(result["transport_mode"], "TRANSIT")
        self.assertEqual(
            [segment["type"] for segment in result["segments"]],
            ["WALK", "TRANSIT", "TRANSIT", "WALK"],
        )
        self.assertEqual(
            result["segments"][1]["line_name"],
            "昭和バス・九州大学線 2M（九大学研都市駅行）",
        )
        self.assertEqual(
            result["segments"][2]["line_name"],
            "JR筑肥線・福岡市地下鉄空港線（福岡空港行）",
        )
        self.assertEqual(
            set(result),
            {
                "origin",
                "destination",
                "departure_at",
                "arrival_at",
                "duration_minutes",
                "transport_mode",
                "segments",
            },
        )
        self.assertEqual(
            set(result["segments"][0]),
            {
                "type",
                "from",
                "to",
                "departure_at",
                "arrival_at",
                "duration_minutes",
                "line_name",
            },
        )

    def test_mock_shifts_service_seconds_to_requested_arrival(self):
        result = routes_service.search_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 26, 9, 40),
            provider_name="mock",
            origin_display_name="九州大学 伊都キャンパス",
            destination_display_name="Garraway F",
        )

        self.assertEqual(result["departure_at"], "2026-08-26T08:22")
        self.assertEqual(result["arrival_at"], "2026-08-26T09:25")
        self.assertEqual(result["duration_minutes"], 63)
        self.assertEqual(result["segments"][0]["departure_at"], "2026-08-26T08:22")
        self.assertEqual(result["segments"][2]["departure_at"], "2026-08-26T08:52")

    def test_converter_handles_service_seconds_across_midnight_and_rounds_up(self):
        response_data = {
            "date": "2026-08-25",
            "timezone": "Asia/Tokyo",
            "options": [
                {
                    "journey": {
                        "departureSecs": 86340,
                        "arrivalSecs": 86430,
                        "durationSecs": 90,
                        "legs": [
                            {
                                "kind": "transit",
                                "routeName": "JR線",
                                "from": {"id": "a", "name": "始発駅"},
                                "to": {"id": "b", "name": "終着駅"},
                                "departureSecs": 86340,
                                "arrivalSecs": 86430,
                            }
                        ],
                    }
                }
            ],
        }

        result = routes_service.convert_transit_route(
            response_data,
            "出発地",
            "目的地",
        )

        self.assertEqual(result["departure_at"], "2026-08-25T23:59")
        self.assertEqual(result["arrival_at"], "2026-08-26T00:00")
        self.assertEqual(result["duration_minutes"], 2)
        self.assertEqual(result["segments"][0]["duration_minutes"], 2)

    def test_converter_reports_no_options_and_walking_only(self):
        with self.assertRaises(routes_service.RouteNotFoundError):
            routes_service.convert_transit_route(
                {"options": []},
                "出発地",
                "目的地",
            )

        walking_response = load_fixture()
        walking_response["options"][0]["journey"]["legs"] = [
            {
                "kind": "walk",
                "from": {"id": "a", "name": "出発地"},
                "to": {"id": "b", "name": "目的地"},
                "departureSecs": 32040,
                "arrivalSecs": 35820,
            }
        ]
        with self.assertRaises(routes_service.RouteNotFoundError):
            routes_service.convert_transit_route(
                walking_response,
                "出発地",
                "目的地",
            )

    def test_converter_rejects_invalid_json_and_response_shapes(self):
        invalid_responses = [
            [],
            {},
            {"date": "20260825", "timezone": "Asia/Tokyo", "options": "invalid"},
            {
                "date": "20260825",
                "timezone": "Asia/Tokyo",
                "options": [{"journey": "invalid"}],
            },
            {
                "date": "20260825",
                "timezone": "Unknown/Zone",
                "options": load_fixture()["options"],
            },
            {
                "date": "20260825",
                "timezone": "Asia/Tokyo",
                "options": [
                    {
                        "journey": {
                            "departureSecs": 1e100,
                            "arrivalSecs": 1e100,
                            "durationSecs": 1,
                            "legs": [
                                {
                                    "kind": "transit",
                                    "routeName": "JR線",
                                    "from": {"name": "出発駅"},
                                    "to": {"name": "到着駅"},
                                    "departureSecs": 1e100,
                                    "arrivalSecs": 1e100,
                                }
                            ],
                        }
                    }
                ],
            },
        ]
        for response_data in invalid_responses:
            with self.subTest(response_data=response_data):
                with self.assertRaises(routes_service.RoutesResponseError):
                    routes_service.convert_transit_route(
                        response_data,
                        "出発地",
                        "目的地",
                    )

    def test_provider_selection_defaults_to_transit_and_rejects_unknown_name(self):
        self.assertEqual(set(ROUTE_PROVIDERS), {"transit", "mock"})
        provider = Mock(return_value=load_fixture())
        with (
            patch.dict(os.environ, {}, clear=True),
            patch("routes_service.get_route_provider", return_value=provider) as get_provider,
        ):
            routes_service.search_route(
                "33.596,130.215",
                "33.586,130.398",
                datetime(2026, 8, 25, 10, 12),
                origin_display_name="出発地",
                destination_display_name="目的地",
            )
        get_provider.assert_called_once_with("transit")
        provider.assert_called_once()
        self.assertEqual(
            provider.call_args.kwargs["origin_display_name"],
            "出発地",
        )

        with self.assertRaises(routes_service.RouteProviderError):
            routes_service.search_route(
                "出発地",
                "目的地",
                datetime(2026, 8, 25, 10, 12),
                provider_name="unknown",
            )


class TransitProviderTest(unittest.TestCase):
    @patch("route_providers.transit_provider.httpx.get")
    def test_builds_arrival_query_and_normalizes_both_places(self, mock_get):
        mock_get.side_effect = [
            make_response(
                reverse_payload(
                    "九州大学 伊都キャンパス",
                    endpoint="feed:origin-station",
                )
            ),
            make_response(
                reverse_payload("Garraway F", endpoint="feed:destination-stop", kind="stop")
            ),
            make_response(load_fixture()),
        ]

        result = transit_provider.get_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 25, 1, 12, tzinfo=timezone.utc),
            origin_display_name="九州大学　伊都キャンパス駅",
            destination_display_name="Garraway F",
        )

        self.assertEqual(result["options"][0]["id"], "demo-option-1")
        self.assertEqual(mock_get.call_count, 3)
        self.assertEqual(
            mock_get.call_args_list[0].kwargs["params"],
            {
                "lat": 33.596,
                "lon": 130.215,
                "radiusMeters": 300,
                "limit": 10,
            },
        )
        self.assertEqual(
            mock_get.call_args_list[1].kwargs["params"]["lon"],
            130.398,
        )
        plan_request = mock_get.call_args_list[2]
        self.assertEqual(plan_request.args[0], transit_provider.GUIDANCE_PLAN_URL)
        self.assertEqual(
            plan_request.kwargs["params"],
            {
                "from": "feed:origin-station",
                "to": "feed:destination-stop",
                "date": "20260825",
                "time": "10:12",
                "type": "arrival",
                "numItineraries": "1",
                "strategy": "balanced",
                "live": "false",
                "tracking": "none",
                "fromLabel": "九州大学　伊都キャンパス駅",
                "toLabel": "Garraway F",
            },
        )
        self.assertEqual(plan_request.kwargs["timeout"], 10.0)

    @patch("route_providers.transit_provider.httpx.get")
    def test_nearest_matching_station_wins(self, mock_get):
        reverse_result = {
            "places": [
                {
                    "endpoint": "feed:far",
                    "kind": "station",
                    "name": "九大学研都市駅",
                    "distanceMeters": 45,
                },
                {
                    "endpoint": "feed:nearest",
                    "kind": "stop",
                    "name": "九大学研都市",
                    "distanceMeters": 12,
                },
                {
                    "endpoint": "geo:33.5,130.2",
                    "kind": "station",
                    "name": "九大学研都市駅",
                    "distanceMeters": 5,
                },
            ]
        }
        mock_get.side_effect = [
            make_response(reverse_result),
            make_response(load_fixture()),
        ]

        transit_provider.get_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 25, 10, 12),
            origin_display_name="九大学研都市駅",
        )

        plan_params = mock_get.call_args_list[1].kwargs["params"]
        self.assertEqual(plan_params["from"], "feed:nearest")

    @patch("route_providers.transit_provider.httpx.get")
    def test_name_mismatch_and_nearby_facility_do_not_snap(self, mock_get):
        reverse_result = {
            "places": [
                {
                    "endpoint": "feed:facility",
                    "kind": "place",
                    "name": "目的施設駅",
                    "distanceMeters": 2,
                },
                {
                    "endpoint": "feed:too-far",
                    "kind": "station",
                    "name": "目的施設駅",
                    "distanceMeters": 301,
                },
                {
                    "endpoint": "feed:other-station",
                    "kind": "station",
                    "name": "別の駅",
                    "distanceMeters": 12,
                },
            ]
        }
        mock_get.side_effect = [
            make_response(reverse_result),
            make_response(load_fixture()),
        ]

        transit_provider.get_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 25, 10, 12),
            origin_display_name="目的施設",
        )

        self.assertEqual(
            mock_get.call_args_list[1].kwargs["params"]["from"],
            "geo:33.596,130.215",
        )

    @patch("route_providers.transit_provider.httpx.get")
    def test_reverse_lookup_failures_fall_back_to_geo(self, mock_get):
        failures = [
            httpx.TimeoutException("timeout"),
            httpx.ConnectError("connection failed"),
            make_response({"error": "unavailable"}, status_code=503),
            make_response(json_error=True),
            make_response({"places": "invalid"}),
        ]
        for reverse_failure in failures:
            with self.subTest(failure=reverse_failure):
                mock_get.reset_mock()
                mock_get.side_effect = [reverse_failure, make_response(load_fixture())]
                transit_provider.get_route(
                    "33.596,130.215",
                    "33.586,130.398",
                    datetime(2026, 8, 25, 10, 12),
                    origin_display_name="九大学研都市駅",
                )
                self.assertEqual(mock_get.call_count, 2)
                self.assertEqual(
                    mock_get.call_args_list[1].kwargs["params"]["from"],
                    "geo:33.596,130.215",
                )

    @patch("route_providers.transit_provider.httpx.get")
    def test_planning_errors_are_distinguished(self, mock_get):
        failures = [
            (httpx.TimeoutException("timeout"), transit_provider.TransitTimeoutError, True),
            (httpx.ConnectError("connection failed"), transit_provider.TransitConnectionError, True),
            (make_response({}, status_code=502), transit_provider.TransitHttpError, False),
            (make_response(json_error=True), transit_provider.TransitResponseError, False),
            (make_response([]), transit_provider.TransitResponseError, False),
        ]
        for failure, error_type, is_exception in failures:
            with self.subTest(error_type=error_type.__name__):
                mock_get.reset_mock()
                mock_get.side_effect = failure if is_exception else None
                mock_get.return_value = None if is_exception else failure
                with self.assertRaises(error_type):
                    transit_provider.get_route(
                        "33.596,130.215",
                        "33.586,130.398",
                        datetime(2026, 8, 25, 10, 12),
                    )

    @patch("route_providers.transit_provider.httpx.get")
    def test_text_only_location_requires_places_candidate(self, mock_get):
        with self.assertRaises(transit_provider.TransitEndpointResolutionError):
            transit_provider.get_route(
                "博多駅",
                "33.586,130.398",
                datetime(2026, 8, 25, 10, 12),
            )
        mock_get.assert_not_called()

    @patch("route_providers.transit_provider.httpx.get")
    def test_text_only_destination_is_rejected_before_reverse_lookup(self, mock_get):
        with self.assertRaises(transit_provider.TransitEndpointResolutionError):
            transit_provider.get_route(
                "33.596,130.215",
                "福岡タワー",
                datetime(2026, 8, 25, 10, 12),
                origin_display_name="出発地",
            )
        mock_get.assert_not_called()

    @patch("route_providers.transit_provider.httpx.get")
    def test_invalid_coordinates_are_input_resolution_errors(self, mock_get):
        with self.assertRaises(transit_provider.TransitEndpointResolutionError):
            transit_provider.get_route(
                "91,130.2",
                "33.586,130.398",
                datetime(2026, 8, 25, 10, 12),
            )
        mock_get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
