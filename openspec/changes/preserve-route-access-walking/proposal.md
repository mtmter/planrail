## Why

Transit API can report walking between a geographic endpoint and the public-transport network separately from `journey.legs`. The converter currently drops that information, so routes from or to general facilities can omit a real access or egress segment even though the API returned its duration.

## What Changes

- Convert positive `journey.accessWalkSecs` and `journey.egressWalkSecs` into existing `WALK` RouteSegments using the Places display names, adjacent journey stop names, and journey-level times.
- Reject malformed or internally inconsistent access/egress values, and reject positive values when the adjacent stop name needed for a segment is missing, through the existing response-error path.
- Preserve journey-leg segments, route-level walking metrics, station/stop endpoint normalization, API response shape, and persisted travel-plan schema.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `places-and-route-search`: Define conversion of Transit access/egress walking into existing RouteSegments and validation of the associated response data.

## Impact

- Affected implementation: `backend/routes_service.py` and its converter tests/Transit fixture.
- The shared RouteCandidate response, Firestore travel-plan shape, and route display remain unchanged; existing segment serialization and rendering handle the added `WALK` segments.
- Endpoint resolution remains based on the existing conservative station/stop name match and `geo:` fallback. No new walking is inferred from proximity or from a snapped endpoint.
