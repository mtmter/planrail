import copy
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
ACCESS_EGRESS_FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "transit_guidance_plan_access_egress.json"
)


def load_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def load_access_egress_fixture():
    return json.loads(ACCESS_EGRESS_FIXTURE_PATH.read_text(encoding="utf-8"))


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
    def test_access_egress_fixture_contains_facility_and_station_leg(self):
        response_data = load_access_egress_fixture()
        journey = response_data["options"][0]["journey"]

        self.assertEqual(response_data["from"]["name"], "津山中学校・高等学校")
        self.assertEqual(response_data["to"]["name"], "岡山県立図書館")
        self.assertEqual(journey["accessWalkSecs"], 900)
        self.assertEqual(journey["egressWalkSecs"], 600)
        self.assertEqual(journey["legs"][0]["from"]["name"], "津山")
        self.assertEqual(journey["legs"][0]["to"]["name"], "岡山")

    def test_search_route_preserves_timeout_as_distinct_service_error(self):
        transit_timeout = transit_provider.TransitTimeoutError(
            "Transit guidance planがタイムアウトしました"
        )
        provider = Mock(side_effect=transit_timeout)

        with patch("routes_service.get_route_provider", return_value=provider):
            with self.assertRaises(
                routes_service.RouteProviderTimeoutError
            ) as context:
                routes_service.search_route(
                    "33.596,130.215",
                    "33.586,130.398",
                    datetime(2026, 8, 25, 10, 12),
                )

        self.assertIs(context.exception.__cause__, transit_timeout)
        self.assertNotIsInstance(context.exception, routes_service.RouteProviderError)

        provider.side_effect = transit_provider.TransitConnectionError(
            "Transit APIへ接続できませんでした"
        )
        with patch("routes_service.get_route_provider", return_value=provider):
            with self.assertRaises(routes_service.RouteProviderError) as context:
                routes_service.search_route(
                    "33.596,130.215",
                    "33.586,130.398",
                    datetime(2026, 8, 25, 10, 12),
                )

        self.assertIsInstance(
            context.exception.__cause__, transit_provider.TransitConnectionError
        )

    def test_mock_fixture_uses_transit_converter_and_common_route_shape(self):
        result = routes_service.search_route(
            "33.596,130.215",
            "33.586,130.398",
            datetime(2026, 8, 25, 10, 12),
            provider_name="mock",
            origin_display_name="九州大学 伊都キャンパス",
            destination_display_name="Garraway F",
        )

        self.assertEqual(len(result["candidates"]), 3)
        self.assertEqual(result["recommended_candidate_id"], "candidate-1")
        self.assertEqual(result["warnings"], [])
        route = result["candidates"][0]
        self.assertEqual(route["origin"], "九州大学 伊都キャンパス")
        self.assertEqual(route["destination"], "Garraway F")
        self.assertEqual(route["departure_at"], "2026-08-25T08:54")
        self.assertEqual(route["arrival_at"], "2026-08-25T09:57")
        self.assertEqual(route["duration_minutes"], 63)
        self.assertEqual(route["transport_mode"], "TRANSIT")
        self.assertEqual(route["transfer_count"], 1)
        self.assertEqual(route["walk_minutes"], 10)
        self.assertEqual(route["wait_minutes"], 8)
        self.assertIsNone(route["fare"])
        self.assertEqual(
            [segment["type"] for segment in route["segments"]],
            ["WALK", "TRANSIT", "TRANSIT", "WALK"],
        )
        self.assertEqual(
            route["segments"][1]["line_name"],
            "昭和バス・九州大学線 2M（九大学研都市駅行）",
        )
        self.assertEqual(
            route["segments"][2]["line_name"],
            "JR筑肥線・福岡市地下鉄空港線（福岡空港行）",
        )
        self.assertEqual(
            set(route),
            {
                "candidate_id",
                "origin",
                "destination",
                "departure_at",
                "arrival_at",
                "duration_minutes",
                "transport_mode",
                "transfer_count",
                "walk_minutes",
                "wait_minutes",
                "fare",
                "segments",
            },
        )
        self.assertEqual(
            set(route["segments"][0]),
            {
                "type",
                "from",
                "to",
                "departure_at",
                "arrival_at",
                "duration_minutes",
                "line_name",
                "mode",
                "train_type",
                "headsign",
                "from_platform",
                "to_platform",
                "color",
                "headway_based",
            },
        )
        self.assertEqual(
            [candidate["candidate_id"] for candidate in result["candidates"]],
            ["candidate-1", "candidate-2", "candidate-3"],
        )
        self.assertEqual(result["candidates"][1]["fare"]["ic"], 440)
        self.assertEqual(result["candidates"][1]["fare"]["ticket"], 450)
        self.assertEqual(
            result["candidates"][1]["segments"][1]["train_type"],
            "快速",
        )
        self.assertEqual(
            result["candidates"][1]["segments"][1]["from_platform"],
            "1番のりば",
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

        route = result["candidates"][0]
        self.assertEqual(route["departure_at"], "2026-08-26T08:22")
        self.assertEqual(route["arrival_at"], "2026-08-26T09:25")
        self.assertEqual(route["duration_minutes"], 63)
        self.assertEqual(route["segments"][0]["departure_at"], "2026-08-26T08:22")
        self.assertEqual(route["segments"][2]["departure_at"], "2026-08-26T08:52")

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

        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )

        route = result["candidates"][0]
        self.assertEqual(route["departure_at"], "2026-08-25T23:59")
        self.assertEqual(route["arrival_at"], "2026-08-26T00:00")
        self.assertEqual(route["duration_minutes"], 2)
        self.assertEqual(route["segments"][0]["duration_minutes"], 2)

    def test_converter_wraps_legs_with_access_and_egress_walk_segments(self):
        response_data = load_access_egress_fixture()
        result = routes_service.convert_transit_routes(
            response_data,
            "津山中学校・高等学校",
            "岡山県立図書館",
        )

        route = result["candidates"][0]
        access, transit, egress = route["segments"]
        self.assertEqual(route["origin"], "津山中学校・高等学校")
        self.assertEqual(route["destination"], "岡山県立図書館")
        self.assertEqual(
            [segment["type"] for segment in route["segments"]],
            ["WALK", "TRANSIT", "WALK"],
        )
        self.assertEqual(
            (access["from"], access["to"]),
            ("津山中学校・高等学校", "津山"),
        )
        self.assertEqual(
            (access["departure_at"], access["arrival_at"], access["duration_minutes"]),
            ("2026-08-25T08:54", "2026-08-25T09:09", 15),
        )
        self.assertEqual(
            (transit["from"], transit["to"], transit["departure_at"], transit["arrival_at"]),
            ("津山", "岡山", "2026-08-25T09:12", "2026-08-25T09:47"),
        )
        self.assertEqual(
            (egress["from"], egress["to"]),
            ("岡山", "岡山県立図書館"),
        )
        self.assertEqual(
            (egress["departure_at"], egress["arrival_at"], egress["duration_minutes"]),
            ("2026-08-25T09:47", "2026-08-25T09:57", 10),
        )
        segment_fields = {
            "type",
            "from",
            "to",
            "departure_at",
            "arrival_at",
            "duration_minutes",
            "line_name",
            "mode",
            "train_type",
            "headsign",
            "from_platform",
            "to_platform",
            "color",
            "headway_based",
        }
        for segment in (access, egress):
            self.assertEqual(set(segment), segment_fields)
            self.assertEqual(segment["line_name"], None)
            for field in (
                "mode",
                "train_type",
                "headsign",
                "from_platform",
                "to_platform",
                "color",
                "headway_based",
            ):
                self.assertIsNone(segment[field])

        self.assertEqual(route["walk_minutes"], 40)
        response_without_external_walks = copy.deepcopy(response_data)
        journey = response_without_external_walks["options"][0]["journey"]
        journey.pop("accessWalkSecs")
        journey.pop("egressWalkSecs")
        route_without_external_walks = routes_service.convert_transit_routes(
            response_without_external_walks,
            "津山中学校・高等学校",
            "岡山県立図書館",
        )["candidates"][0]
        self.assertEqual(transit, route_without_external_walks["segments"][0])

    def test_converter_handles_each_external_walk_side_and_omitted_or_zero_values(self):
        cases = [
            ("access only", {"egressWalkSecs": None}, ["WALK", "TRANSIT"]),
            ("egress only", {"accessWalkSecs": None}, ["TRANSIT", "WALK"]),
            ("omitted", {"accessWalkSecs": None, "egressWalkSecs": None}, ["TRANSIT"]),
            ("zero", {"accessWalkSecs": 0, "egressWalkSecs": 0}, ["TRANSIT"]),
        ]

        for case_name, updates, expected_types in cases:
            with self.subTest(case=case_name):
                response_data = load_access_egress_fixture()
                journey = response_data["options"][0]["journey"]
                for field, value in updates.items():
                    if value is None:
                        journey.pop(field, None)
                    else:
                        journey[field] = value

                route = routes_service.convert_transit_routes(
                    response_data,
                    "津山中学校・高等学校",
                    "岡山県立図書館",
                )["candidates"][0]
                self.assertEqual(
                    [segment["type"] for segment in route["segments"]],
                    expected_types,
                )

    def test_converter_rounds_external_walks_without_absorbing_wait_time(self):
        response_data = load_access_egress_fixture()
        journey = response_data["options"][0]["journey"]
        journey["accessWalkSecs"] = 901
        journey["egressWalkSecs"] = 601

        route = routes_service.convert_transit_routes(
            response_data,
            "津山中学校・高等学校",
            "岡山県立図書館",
        )["candidates"][0]
        access, transit, egress = route["segments"]

        self.assertEqual(
            (access["departure_at"], access["arrival_at"], access["duration_minutes"]),
            ("2026-08-25T08:54", "2026-08-25T09:09", 16),
        )
        self.assertEqual(transit["departure_at"], "2026-08-25T09:12")
        self.assertEqual(
            (egress["departure_at"], egress["arrival_at"], egress["duration_minutes"]),
            ("2026-08-25T09:46", "2026-08-25T09:57", 11),
        )

    def test_converter_rejects_malformed_or_unbuildable_external_walks(self):
        invalid_values = [-1, "900", True, float("nan"), float("inf")]
        for field in ("accessWalkSecs", "egressWalkSecs"):
            for invalid_value in invalid_values:
                with self.subTest(field=field, value=invalid_value):
                    response_data = load_access_egress_fixture()
                    response_data["options"][0]["journey"][field] = invalid_value
                    with self.assertRaises(routes_service.RoutesResponseError):
                        routes_service.convert_transit_routes(
                            response_data,
                            "津山中学校・高等学校",
                            "岡山県立図書館",
                        )

        inconsistent_response = load_access_egress_fixture()
        inconsistent_journey = inconsistent_response["options"][0]["journey"]
        inconsistent_journey["accessWalkSecs"] = 1900
        inconsistent_journey["egressWalkSecs"] = 2000
        with self.assertRaises(routes_service.RoutesResponseError):
            routes_service.convert_transit_routes(
                inconsistent_response,
                "津山中学校・高等学校",
                "岡山県立図書館",
            )

        inconsistent_walking_option = load_access_egress_fixture()
        walking_journey = inconsistent_walking_option["options"][0]["journey"]
        walking_journey["legs"] = [
            {
                "kind": "walk",
                "from": {"name": "津山"},
                "to": {"name": "岡山"},
                "departureSecs": 32040,
                "arrivalSecs": 35820,
            }
        ]
        walking_journey["accessWalkSecs"] = 4000
        walking_journey.pop("egressWalkSecs")
        with self.assertRaises(routes_service.RoutesResponseError):
            routes_service.convert_transit_routes(
                inconsistent_walking_option,
                "津山中学校・高等学校",
                "岡山県立図書館",
            )

        for side, endpoint_field in (
            ("access", "from"),
            ("egress", "to"),
        ):
            with self.subTest(missing_stop=side):
                response_data = load_access_egress_fixture()
                journey = response_data["options"][0]["journey"]
                journey["legs"][0][endpoint_field]["name"] = "  "
                with self.assertRaises(routes_service.RoutesResponseError):
                    routes_service.convert_transit_routes(
                        response_data,
                        "津山中学校・高等学校",
                        "岡山県立図書館",
                    )

        no_legs_response = load_access_egress_fixture()
        no_legs_response["options"][0]["journey"]["legs"] = []
        with self.assertRaises(routes_service.RoutesResponseError):
            routes_service.convert_transit_routes(
                no_legs_response,
                "津山中学校・高等学校",
                "岡山県立図書館",
            )

    def test_converter_reports_no_options_and_walking_only(self):
        with self.assertRaises(routes_service.RouteNotFoundError):
            routes_service.convert_transit_routes(
                {"options": []},
                "出発地",
                "目的地",
            )

    def test_converter_preserves_order_and_filters_only_walking_options(self):
        response_data = load_fixture()
        walking_option = copy.deepcopy(response_data["options"][0])
        walking_option["id"] = "walking-only"
        walking_option["recommended"] = True
        walking_option["journey"]["legs"] = [
            {
                "kind": "walk",
                "from": {"id": "a", "name": "出発地"},
                "to": {"id": "b", "name": "目的地"},
                "departureSecs": 32040,
                "arrivalSecs": 35820,
            }
        ]
        response_data["options"] = [
            walking_option,
            response_data["options"][1],
            response_data["options"][0],
        ]
        response_data["options"][1]["recommended"] = False
        response_data["options"][2]["recommended"] = False
        response_data["decision"]["recommendedOptionId"] = "walking-only"

        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )

        self.assertEqual(
            [candidate["candidate_id"] for candidate in result["candidates"]],
            ["candidate-1", "candidate-2"],
        )
        self.assertEqual(result["recommended_candidate_id"], "candidate-1")
        self.assertEqual(
            result["candidates"][0]["departure_at"],
            "2026-08-25T09:04",
        )
        self.assertEqual(
            result["candidates"][1]["departure_at"],
            "2026-08-25T08:54",
        )

    def test_converter_prefers_transit_recommendation_then_option_flag_then_first(self):
        response_data = load_fixture()
        response_data["decision"]["recommendedOptionId"] = "demo-option-3"
        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )
        self.assertEqual(result["recommended_candidate_id"], "candidate-3")

        response_data["decision"].pop("recommendedOptionId")
        response_data["options"][0]["recommended"] = False
        response_data["options"][1]["recommended"] = True
        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )
        self.assertEqual(result["recommended_candidate_id"], "candidate-2")

        response_data["options"][1]["recommended"] = False
        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )
        self.assertEqual(result["recommended_candidate_id"], "candidate-1")

    def test_converter_maps_warning_coverage_codes_and_ignores_unknown_and_info(self):
        response_data = load_fixture()
        response_data["coverage"]["notices"] = [
            {
                "severity": "warning",
                "code": "staleFeedData",
                "message": "Transit raw message must not leak",
            },
            {"severity": "info", "code": "loadedDataScope", "message": "info"},
            {"severity": "warning", "code": "futureCode", "message": "unknown"},
            {"severity": "warning", "code": ["malformed"], "message": "invalid"},
            None,
        ]

        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )

        self.assertEqual(
            result["warnings"],
            ["時刻表データが古く、実際の運行と異なる場合があります。"],
        )

    def test_converter_uses_journey_fare_when_option_metric_is_missing(self):
        response_data = load_fixture()
        response_data["options"][0]["journey"]["fare"] = {
            "currency": "JPY",
            "ticket": 500,
            "ic": 490,
        }
        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )
        self.assertEqual(
            result["candidates"][0]["fare"],
            {"currency": "JPY", "ticket": 500, "ic": 490},
        )

    def test_converter_keeps_missing_comparison_and_segment_values_nullable(self):
        response_data = load_fixture()
        option = response_data["options"][0]
        option.pop("metrics")
        option["journey"].pop("transferCount")
        transit_leg = next(
            leg
            for leg in option["journey"]["legs"]
            if leg["kind"] == "transit"
        )
        for field_name in (
            "mode",
            "trainType",
            "headsign",
            "color",
            "headwayBased",
        ):
            transit_leg.pop(field_name, None)
        transit_leg["from"].pop("platformCode", None)
        transit_leg["to"].pop("platformCode", None)
        result = routes_service.convert_transit_routes(
            response_data,
            "出発地",
            "目的地",
        )
        candidate = result["candidates"][0]
        self.assertIsNone(candidate["transfer_count"])
        self.assertIsNone(candidate["walk_minutes"])
        self.assertIsNone(candidate["wait_minutes"])
        self.assertIsNone(candidate["fare"])
        self.assertIsNone(candidate["segments"][1]["mode"])
        self.assertIsNone(candidate["segments"][1]["train_type"])
        self.assertIsNone(candidate["segments"][1]["headsign"])
        self.assertIsNone(candidate["segments"][1]["from_platform"])
        self.assertIsNone(candidate["segments"][1]["to_platform"])
        self.assertIsNone(candidate["segments"][1]["color"])
        self.assertIsNone(candidate["segments"][1]["headway_based"])

    def test_converter_does_not_expose_transit_metadata_or_geometry(self):
        result = routes_service.convert_transit_routes(
            load_fixture(),
            "出発地",
            "目的地",
        )
        self.assertEqual(
            set(result),
            {"candidates", "recommended_candidate_id", "warnings"},
        )
        self.assertNotIn("id", result["candidates"][0])
        self.assertNotIn("rank", result["candidates"][0])
        self.assertNotIn("score", result["candidates"][0])
        self.assertNotIn("map", result)

        walking_response = load_fixture()
        for option in walking_response["options"]:
            option["journey"]["legs"] = [
                {
                    "kind": "walk",
                    "from": {"id": "a", "name": "出発地"},
                    "to": {"id": "b", "name": "目的地"},
                    "departureSecs": 32040,
                    "arrivalSecs": 35820,
                }
            ]
        with self.assertRaises(routes_service.RouteNotFoundError):
            routes_service.convert_transit_routes(
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
                    routes_service.convert_transit_routes(
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
            mock_get.call_args_list[0].kwargs["timeout"],
            10.0,
        )
        self.assertEqual(
            mock_get.call_args_list[1].kwargs["timeout"],
            10.0,
        )
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
                "numItineraries": "3",
                "strategy": "balanced",
                "live": "false",
                "tracking": "none",
                "fromLabel": "九州大学　伊都キャンパス駅",
                "toLabel": "Garraway F",
            },
        )
        self.assertEqual(
            plan_request.kwargs["timeout"],
            30.0,
        )

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
    def test_snapped_station_endpoints_do_not_gain_external_walk_segments(
        self,
        mock_get,
    ):
        plan_response = {
            "date": "20260825",
            "timezone": "Asia/Tokyo",
            "options": [
                {
                    "metrics": {"durationSecs": 1800, "walkSecs": 0},
                    "journey": {
                        "departureSecs": 32040,
                        "arrivalSecs": 33840,
                        "durationSecs": 1800,
                        "legs": [
                            {
                                "kind": "transit",
                                "routeName": "JR線",
                                "from": {"name": "岡山"},
                                "to": {"name": "津山"},
                                "departureSecs": 32040,
                                "arrivalSecs": 33840,
                            }
                        ],
                    },
                }
            ],
        }
        mock_get.side_effect = [
            make_response(reverse_payload("岡山駅", endpoint="feed:okayama")),
            make_response(reverse_payload("津山駅", endpoint="feed:tsuyama")),
            make_response(plan_response),
        ]

        response_data = transit_provider.get_route(
            "34.666,133.918",
            "35.054,134.004",
            datetime(2026, 8, 25, 9, 30),
            origin_display_name="岡山駅",
            destination_display_name="津山駅",
        )
        route = routes_service.convert_transit_routes(
            response_data,
            "岡山駅",
            "津山駅",
        )["candidates"][0]

        planning_params = mock_get.call_args_list[2].kwargs["params"]
        self.assertEqual(planning_params["from"], "feed:okayama")
        self.assertEqual(planning_params["to"], "feed:tsuyama")
        self.assertEqual(
            [segment["type"] for segment in route["segments"]],
            ["TRANSIT"],
        )

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
                    mock_get.call_args_list[0].kwargs["timeout"],
                    10.0,
                )
                self.assertEqual(
                    mock_get.call_args_list[1].kwargs["timeout"],
                    30.0,
                )
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
