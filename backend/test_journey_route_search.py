import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import main


class JourneyRouteSearchTest(unittest.TestCase):
    def test_journey_request_rejects_destination_without_coordinates(self):
        request = main.DirectRouteSearchRequest.model_validate(
            {
                "origin": {"name": "出発", "lat": 33.5, "lng": 130.4},
                "destination": {"name": "目的地"},
                "time_constraint": {"type": "arrival", "at": "2026-10-01T12:00"},
            }
        )
        with patch.dict(os.environ, {"ROUTE_PROVIDER": "mock"}, clear=True):
            with self.assertRaises(HTTPException) as context:
                main.search_direct_route(request)

        self.assertEqual(context.exception.status_code, 400)

    def test_journey_request_uses_nested_place_points_and_arrival_constraint(self):
        request = main.DirectRouteSearchRequest.model_validate(
            {
                "origin": {"name": "出発", "lat": 33.5, "lng": 130.4},
                "destination": {"name": "到着", "lat": 33.6, "lng": 130.5},
                "time_constraint": {"type": "arrival", "at": "2026-10-01T12:00"},
            }
        )
        with patch.dict(os.environ, {"ROUTE_PROVIDER": "mock"}, clear=True):
            result = main.search_direct_route(request)

        self.assertEqual(result["candidates"][0]["origin"], "出発")
        self.assertEqual(result["candidates"][0]["destination"], "到着")

    def test_latest_arrival_constraint_filters_candidates(self):
        request = main.DirectRouteSearchRequest.model_validate(
            {
                "origin": {"name": "出発", "lat": 33.5, "lng": 130.4},
                "destination": {"name": "到着", "lat": 33.6, "lng": 130.5},
                "time_constraint": {
                    "type": "departure",
                    "at": "2026-10-01T08:00",
                    "latest_arrival_at": "2026-10-01T09:00",
                },
            }
        )
        with patch(
            "main.search_route",
            return_value={
                "candidates": [
                    {"candidate_id": "candidate-1", "departure_at": "2026-10-01T08:10", "arrival_at": "2026-10-01T08:50"},
                    {"candidate_id": "candidate-2", "departure_at": "2026-10-01T08:20", "arrival_at": "2026-10-01T09:10"},
                ],
                "recommended_candidate_id": "candidate-2",
                "warnings": [],
            },
        ):
            result = main.search_direct_route(request)

        self.assertEqual([item["candidate_id"] for item in result["candidates"]], ["candidate-1"])
        self.assertEqual(result["recommended_candidate_id"], "candidate-1")

    def test_invalid_latest_arrival_is_rejected_before_provider_call(self):
        request = main.DirectRouteSearchRequest.model_validate(
            {
                "origin": {"name": "出発", "lat": 33.5, "lng": 130.4},
                "destination": {"name": "到着", "lat": 33.6, "lng": 130.5},
                "time_constraint": {
                    "type": "departure", "at": "2026-10-01T10:00",
                    "latest_arrival_at": "2026-10-01T09:00",
                },
            }
        )
        with patch("main.search_route") as provider:
            with self.assertRaises(HTTPException) as context:
                main.search_direct_route(request)
        self.assertEqual(context.exception.status_code, 400)
        provider.assert_not_called()

    def test_candidate_without_departure_time_cannot_satisfy_departure_bound(self):
        request = main.DirectRouteSearchRequest.model_validate(
            {
                "origin": {"name": "出発", "lat": 33.5, "lng": 130.4},
                "destination": {"name": "到着", "lat": 33.6, "lng": 130.5},
                "time_constraint": {
                    "type": "departure", "at": "2026-10-01T08:00",
                    "latest_arrival_at": "2026-10-01T09:00",
                },
            }
        )
        with patch("main.search_route", return_value={
            "candidates": [{"candidate_id": "missing-time", "arrival_at": "2026-10-01T08:50"}],
            "recommended_candidate_id": "missing-time",
            "warnings": [],
        }):
            with self.assertRaises(HTTPException) as context:
                main.search_direct_route(request)
        self.assertEqual(context.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
