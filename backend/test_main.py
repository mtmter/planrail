import os
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException

import main
from routes_service import (
    RouteEndpointResolutionError,
    RouteNotFoundError,
    RouteProviderError,
    RouteProviderTimeoutError,
)
from route_providers.transit_provider import (
    TransitHttpError,
    TransitTimeoutError,
)


ROUTE_REQUEST = {
    "origin_name": "九州大学 伊都キャンパス",
    "origin_lat": 33.596,
    "origin_lng": 130.215,
    "event": {
        "start_at": "2026-08-25T10:22",
        "location_name": "Garraway F",
        "destination_lat": 33.586,
        "destination_lng": 130.398,
        "arrival_buffer_minutes": 10,
    },
}


def create_route_request(request_data=ROUTE_REQUEST):
    return main.DirectRouteSearchRequest.model_validate(request_data)


class HealthApiTest(unittest.TestCase):
    def test_health(self):
        self.assertEqual(main.health(), {"status": "ok"})

    def test_only_health_and_route_search_are_registered(self):
        api_routes = {
            (route.path, frozenset(route.methods or []))
            for route in main.app.routes
            if route.path.startswith("/api/")
        }

        self.assertEqual(
            api_routes,
            {
                ("/api/health", frozenset({"GET"})),
                ("/api/route-search", frozenset({"POST"})),
            },
        )


class CorsOriginsTest(unittest.TestCase):
    def test_uses_localhost_origins_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                main.get_cors_origins(),
                [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ],
            )

    def test_reads_multiple_origins_and_ignores_empty_values(self):
        with patch.dict(
            os.environ,
            {
                "CORS_ORIGINS": (
                    " https://ryuute-v2-frontend.vercel.app, "
                    ",https://preview.example.com "
                ),
            },
            clear=True,
        ):
            self.assertEqual(
                main.get_cors_origins(),
                [
                    "https://ryuute-v2-frontend.vercel.app",
                    "https://preview.example.com",
                ],
            )

    def test_allows_wildcard_only_when_explicitly_configured(self):
        with patch.dict(
            os.environ,
            {"CORS_ORIGINS": "*"},
            clear=True,
        ):
            self.assertEqual(main.get_cors_origins(), ["*"])

    def test_uses_localhost_origins_when_config_is_empty(self):
        with patch.dict(
            os.environ,
            {"CORS_ORIGINS": " , "},
            clear=True,
        ):
            self.assertEqual(
                main.get_cors_origins(),
                main.DEFAULT_CORS_ORIGINS,
            )


class RouteSearchApiTest(unittest.TestCase):
    def test_route_search_works_without_database(self):
        with patch.dict(
            os.environ,
            {"ROUTE_PROVIDER": "mock"},
            clear=True,
        ):
            result = main.search_direct_route(create_route_request())

        response = main.RouteSearchResponse.model_validate(result)
        self.assertEqual(len(response.candidates), 3)
        self.assertEqual(response.recommended_candidate_id, "candidate-1")
        self.assertEqual(response.candidates[0].origin, "九州大学 伊都キャンパス")
        self.assertEqual(response.candidates[0].destination, "Garraway F")
        self.assertEqual(response.candidates[0].arrival_at, "2026-08-25T09:57")
        self.assertEqual(response.candidates[0].transport_mode, "TRANSIT")
        response_data = response.model_dump(by_alias=True)
        self.assertEqual(
            set(response_data),
            {"candidates", "recommended_candidate_id", "warnings"},
        )
        self.assertEqual(response_data["candidates"][1]["segments"][1]["from"], "九大工学部")

    def test_route_search_validates_request(self):
        request_without_origin = {
            **ROUTE_REQUEST,
            "origin_name": "",
            "origin_lat": None,
            "origin_lng": None,
        }
        request_without_destination = {
            **ROUTE_REQUEST,
            "event": {
                "start_at": "2026-08-25T10:22",
            },
        }
        request_with_invalid_start = {
            **ROUTE_REQUEST,
            "event": {
                **ROUTE_REQUEST["event"],
                "start_at": "日時ではない値",
            },
        }

        for invalid_request in [
            request_without_origin,
            request_without_destination,
            request_with_invalid_start,
        ]:
            with self.subTest(invalid_request=invalid_request):
                with self.assertRaises(HTTPException) as context:
                    main.search_direct_route(
                        create_route_request(invalid_request),
                    )

                self.assertEqual(context.exception.status_code, 400)

    def test_route_search_requires_places_candidate_when_origin_has_no_coordinates(self):
        request_data = {
            **ROUTE_REQUEST,
            "origin_lat": None,
            "origin_lng": None,
        }
        with patch.dict(os.environ, {"ROUTE_PROVIDER": "transit"}, clear=True):
            with self.assertRaises(HTTPException) as context:
                main.search_direct_route(create_route_request(request_data))

        self.assertEqual(context.exception.status_code, 400)
        self.assertIn("Google Places", context.exception.detail)

    def test_route_search_converts_service_errors(self):
        error_cases = [
            (RouteNotFoundError("経路が見つかりませんでした"), 404),
            (RouteEndpointResolutionError("Places候補を選択してください"), 400),
            (RouteProviderError("接続できませんでした"), 502),
            (RouteProviderTimeoutError("Transitがタイムアウトしました"), 504),
        ]

        with self.assertLogs("main", level="ERROR"):
            for service_error, expected_status in error_cases:
                with self.subTest(expected_status=expected_status):
                    with (
                        patch("main.search_route", side_effect=service_error),
                        self.assertRaises(HTTPException) as context,
                    ):
                        main.search_direct_route(create_route_request())

                    self.assertEqual(context.exception.status_code, expected_status)

    def test_transit_guidance_timeout_becomes_504_at_route_search_api(self):
        transit_timeout = TransitTimeoutError("Transit guidance planがタイムアウトしました")
        provider = Mock(side_effect=transit_timeout)

        with self.assertLogs("main", level="ERROR"):
            with (
                patch("routes_service.get_route_provider", return_value=provider),
                self.assertRaises(HTTPException) as context,
            ):
                main.search_direct_route(create_route_request())

        self.assertEqual(context.exception.status_code, 504)
        self.assertIsInstance(
            context.exception.__cause__, RouteProviderTimeoutError
        )
        self.assertIs(context.exception.__cause__.__cause__, transit_timeout)

    def test_route_search_logs_exception_chain_without_request_data(self):
        sensitive_request = {
            **ROUTE_REQUEST,
            "origin_name": "USER_NAME_SENTINEL",
            "origin_place_id": "PLACE_ID_SENTINEL",
            "origin_lat": 12.345678,
            "origin_lng": 98.765432,
            "event": {
                **ROUTE_REQUEST["event"],
                "destination_lat": 21.987654,
                "destination_lng": 87.654321,
            },
        }
        provider_http_error = TransitHttpError(
            503,
            "https://transit.invalid/plan?lat=12.345678&placeId=PLACE_ID_SENTINEL "
            "user=USER_NAME_SENTINEL",
        )
        try:
            raise provider_http_error
        except TransitHttpError as cause:
            try:
                raise RouteProviderError("Transit provider failure") from cause
            except RouteProviderError as error:
                service_error = error

        with self.assertLogs("main", level="ERROR") as captured:
            with (
                patch("main.search_route", side_effect=service_error),
                self.assertRaises(HTTPException) as context,
            ):
                main.search_direct_route(create_route_request(sensitive_request))

        self.assertEqual(context.exception.status_code, 502)
        log_output = "\n".join(captured.output)
        self.assertIn("RouteProviderError", log_output)
        self.assertIn("TransitHttpError", log_output)
        self.assertIn("transit_http_status_code=503", log_output)
        self.assertIn("Traceback (most recent call last)", log_output)
        for sensitive_value in (
            "USER_NAME_SENTINEL",
            "PLACE_ID_SENTINEL",
            "12.345678",
            "98.765432",
            "21.987654",
            "87.654321",
        ):
            self.assertNotIn(sensitive_value, log_output)

    def test_route_search_logs_timeout_chain_for_504(self):
        transit_error = TransitTimeoutError("Transit guidance planがタイムアウトしました")
        timeout_message = "read timed out for 21.987654,87.654321"
        try:
            raise TimeoutError(timeout_message)
        except TimeoutError as cause:
            try:
                raise transit_error from cause
            except TransitTimeoutError as cause:
                try:
                    raise RouteProviderTimeoutError(str(cause)) from cause
                except RouteProviderTimeoutError as error:
                    service_error = error

        with self.assertLogs("main", level="ERROR") as captured:
            with (
                patch("main.search_route", side_effect=service_error),
                self.assertRaises(HTTPException) as context,
            ):
                main.search_direct_route(create_route_request())

        self.assertEqual(context.exception.status_code, 504)
        log_output = "\n".join(captured.output)
        self.assertIn("RouteProviderTimeoutError", log_output)
        self.assertIn("TransitTimeoutError", log_output)
        self.assertIn("TimeoutError", log_output)
        self.assertIn("Traceback (most recent call last)", log_output)
        self.assertNotIn("21.987654", log_output)
        self.assertNotIn("87.654321", log_output)


if __name__ == "__main__":
    unittest.main()
