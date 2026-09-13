# Change: replace-route-provider-with-transit

## Why

PlanRail currently routes production and local searches through the `mock` or `ekispert` provider. The Ekispert provider, API-key configuration, fixture, and converter are still present, while `routes_service.py` also contains an unused Google Routes API `TRANSIT` implementation and its tests. Replace these pieces with Transit API's `/api/v1/guidance/plan` so public-transit route searches use the intended production provider and keep returning the existing single-route JSON consumed by the React UI and Firestore.

The current code and documents also differ from the requested end state: the provider default is `mock`; Ekispert is the only live provider; and typed origin or destination text is currently sent through as an address when coordinates are absent. Transit planning accepts a station/stop endpoint or `geo:<lat>,<lon>`, so a text-only location must remain saveable as an event but cannot be searched until the user selects a Google Places candidate with coordinates. The implementation must make that input behavior explicit while preserving Google Places and the existing event fields.

## What Changes

- Replace the supported providers with `transit` and `mock`; make `transit` the default and remove Ekispert configuration and code.
- Query Transit API `/api/v1/guidance/plan` for one arrival-time itinerary and convert its response to the current Route JSON.
- Before planning, conservatively resolve matching Google Places station/stop coordinates through `/api/v1/places/reverse`; otherwise use a `geo:` endpoint. Never persist Transit station or stop identifiers.
- Reject options containing no public-transit leg as route-not-found. Keep the `/api/route-search` HTTP and response contracts, except that a location without a Transit-compatible endpoint returns an actionable HTTP 400.
- Change the mock fixture to the Transit guidance-plan response format and run it through the same converter.
- Remove the unused Google Routes API public-transit implementation and its tests. Keep Google Places and the current route-result UI and Firestore travel-plan shape.
- Update provider documentation, environment examples, README, and architecture/deployment documentation to describe Transit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `places-and-route-search`: provider selection, endpoint resolution, Transit arrival searches, response conversion, and error handling change.

The `travel-plans` capability does not need a delta: the shared Route JSON and the Firestore travel-plan fields remain unchanged.

## Explicit Non-Goals

- Multiple route candidates, arrays of routes, candidate comparison, or route-result UI redesign.
- Persisting fare, transfer count, walk/wait time, train type, headsign, platform, route color, score, decision factors, geometry, or coverage notices.
- Displaying Transit coverage notices or adding a Google Maps fallback.
- Google Routes API walking searches or replacing Transit walking legs with Google walking directions.
- Replacing Google Places with Transit place search or expanding the saved Google Places schema.
- Changes to calendar, home, destination, or route-condition settings UI.

## Impact

- Backend provider selection, Transit HTTP integration, endpoint resolution, response conversion, and backend tests.
- Removal of `backend/route_providers/ekispert_provider.py`, `backend/fixtures/ekispert_route_demo.json`, Ekispert-specific tests, and Google Routes `TRANSIT` dead code/tests.
- Provider setup and architecture documentation. The repository documents a configured production `ROUTE_PROVIDER` variable and infers that it currently selects `mock`; production must explicitly use `ROUTE_PROVIDER=transit` after implementation so that an existing environment value does not override the new default.
- No frontend request or Firestore schema change is expected. The existing error display can show the actionable HTTP 400 detail.

## External API References

- [Transit API reference](https://api.transit.ls8h.com/api/docs)
- [Transit API OpenAPI document](https://api.transit.ls8h.com/api/openapi.json)
