# Design: replace-route-provider-with-transit

## Context

`backend/route_providers/__init__.py` currently exposes `mock` and `ekispert`. `routes_service.py` converts Ekispert's `ResultSet.Course` into the Route JSON and also contains a disconnected Google Routes `TRANSIT` implementation. `backend/main.py` already accepts Google Places-derived origin name/address/place ID/coordinates and destination name/address/coordinates, computes event start minus the arrival buffer, and maps missing input to 400, no route to 404, and provider failures to 502. The React result view and Firestore save path consume the current single-route shape directly.

The official Transit OpenAPI document defines `GET /api/v1/guidance/plan` with required `from` and `to`, optional `fromLabel`/`toLabel`, `date` (`YYYYMMDD`), `time` (`HH:MM` or `HH:MM:SS`), `type` (`arrival` is supported), `numItineraries` (1 through 6), `strategy` (`balanced` is supported), `live` (`true`/`false`), and `tracking` (`none`/`origin`/`destination`/`both`). Its response contains `date`, `timezone`, and `options`; each option contains a `journey` with `departureSecs`, `arrivalSecs`, `durationSecs`, and `legs`. Legs are discriminated as `walk` or `transit`; transit legs include `routeName`, endpoint names, and service-date-relative departure/arrival seconds. The same OpenAPI document defines `/api/v1/places/reverse` with `lat`, `lon`, `radiusMeters` (maximum 500), and `limit` (maximum 10); candidates include `kind`, planner `endpoint`, `name`, and `distanceMeters`.

## Goals and Non-Goals

### Goals

- Make Transit the normal provider, keep only `transit` and `mock`, and remove Ekispert-specific code and configuration.
- Use the requested single arrival itinerary and produce the existing common Route JSON without adding provider data to the persisted model.
- Snap only a nearby station/stop whose normalized name exactly matches the Google Places display name; fall back to geographic endpoints in every other reverse-lookup case.
- Classify malformed or unreachable planning responses, no-route responses, and unresolvable user input so the existing HTTP contract remains understandable.
- Keep the implementation local to the provider/service and existing tests; retain Google Places and do not add Google Routes walking behavior.

### Non-Goals

- Multi-option selection or display, additional Transit fields, coverage UI, Google Maps fallback, or Firestore schema changes.
- A general fuzzy place-matching system or Transit autocomplete UI.
- Any Google Routes API use for public transportation or walking in this change.

## Decisions

### Transit provider and request

Add a Transit provider using the existing `httpx` dependency and a bounded timeout. It makes GET requests to `https://api.transit.ls8h.com/api/v1/guidance/plan` with `from`, `to`, `fromLabel`, `toLabel`, `date`, `time`, `type=arrival`, `numItineraries=1`, `strategy=balanced`, `live=false`, and `tracking=none`. The existing internal provider call must receive the origin and destination display labels as well as endpoint strings so it can build the Transit labels and attempt coordinate normalization; this does not change the `/api/route-search` request contract. Treat a naive event datetime as Japan time, consistent with the current Ekispert provider, before formatting `date` and `time`. Transit is public and needs no API key. Timeout, connection, HTTP status, JSON parsing, and response-shape failures remain distinguishable provider/service errors internally; the route endpoint maps provider failures to 502.

### Request-time station normalization

For each endpoint independently, attempt reverse lookup only when both coordinates and a non-empty Google Places display name are available. Call `/api/v1/places/reverse` with `lat`, `lon`, `radiusMeters=300`, and `limit=10`. Consider only `station` and `stop` candidates with a non-empty non-`geo:` planner endpoint and a distance no greater than 300 meters. Normalize each label with Unicode NFKC, case folding, trimming and removal of whitespace, then remove one exact trailing location-kind suffix from a small allowlist (`駅`, `バス停`, `停留所`, `station`, `busstop`, `stop`) and compare for equality. Do not use edit distance, substring, phonetic, or proximity-only matching. Select the nearest name match; a stable response order can break equal-distance ties.

Use the selected planner endpoint only for a match. If no candidate matches, the response is invalid, or reverse lookup times out, fails to connect, returns an HTTP error, or cannot be decoded, pass `geo:<lat>,<lon>` to the planner. A reverse lookup failure must not block an otherwise valid route search. Apply this same flow to origin and destination. The Place ID and Transit endpoint are not placed in the common Route JSON or saved event/travel-plan data.

If coordinates are absent, there is no planner endpoint for the text alone. Return an input-resolution error mapped to HTTP 400 with a message asking the user to select a Google Places candidate. This does not change the ability to save a text-only event.

### Conversion to the common Route JSON

Implement one Transit guidance response converter used by both the live provider and mock fixture. Require a valid object response, a non-empty `options` list, and a valid first option `journey`; use only that first option. Parse the response's `date` and IANA `timezone`, add each `departureSecs`/`arrivalSecs` value to that service-date midnight, then format timestamps in Japan time as `YYYY-MM-DDTHH:mm`. This handles service seconds that cross midnight or are negative. Use `journey.durationSecs` and leg time differences for integer minute values rounded up, consistent with existing service conversion behavior.

Map a `walk` leg to `WALK` with `line_name=null`, and a `transit` leg to `TRANSIT` with `line_name=routeName`. Preserve the origin and destination display labels in the route envelope; use Transit leg endpoint names for each segment. Keep only the current route fields. A missing/invalid option is route-not-found when there are no options, and a malformed journey/leg is a response error. If the selected journey has no `transit` leg, raise route-not-found (404), even if Transit returned a valid walking-only option. Successful results have `transport_mode=TRANSIT`.

### Mock and supported provider configuration

Change the mock fixture to a representative `GuidancePlanResponse` with one option and at least one transit leg. The mock provider loads that payload, shifts service-relative times to the requested arrival while preserving leg intervals, and passes it through the same converter. It must make no network requests. Restrict provider names to `transit` and `mock`; use `transit` if `ROUTE_PROVIDER` is unset. Unknown provider values remain configuration/provider errors and map to HTTP 502. Delete Ekispert code, its fixture and API-key references.

### API and persistence compatibility

Keep `POST /api/route-search`, its request envelope, and the common Route JSON unchanged. Keep the existing 400/404/502 mapping; the API-key-specific 500 path is removed. Existing React components continue to render and save the same route fields. Google Places and event fields (`location_name`, `destination`, `destination_place_id`, `destination_lat`, `destination_lng`) are unchanged. Transit station/stop IDs are used only while resolving and querying a route.

Delete the disconnected Google Routes `TRANSIT` function, constants, helper converters, and tests from `routes_service.py` and `test_routes_service.py`; update architecture docs that currently describe this dead code. Do not introduce a walking provider.

## Risks and Trade-offs

- Exact normalized name equality avoids snapping a nearby venue to an unrelated station but can miss legitimate aliases. Such cases use the geographic endpoint, as required by the conservative policy.
- The Transit API may return valid service seconds with timezone data or payload details outside the expected shape. Strict response validation turns unsupported shapes into 502 rather than silently persisting incomplete routes.
- The reverse API is called once per coordinate endpoint and planning once per search. Reverse failures deliberately fall back to geo; planning failures remain visible as the existing generic service error.
- The production `ROUTE_PROVIDER` value is not visible in the checked-in repository. `docs/deployment.md` says it is configured and infers `mock` from observed output, so deployment must verify/set it to `transit` for the provider replacement to take effect.

## Verification

- Backend unit tests use mocked HTTP responses and the Transit fixture; no test depends on the live Transit API.
- Cover query construction, time conversion, common-route conversion, endpoint normalization/fallback, provider errors, and unknown provider selection.
- Run the backend unittest suite and frontend lint/build to verify the retained API/UI contract.
