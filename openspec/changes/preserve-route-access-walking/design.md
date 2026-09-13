## Context

See `proposal.md` for the motivation. `backend/routes_service.py` currently converts `journey.legs` in order, derives route-level `walk_minutes` only from `option.metrics.walkSecs`, and validates journey/leg seconds before formatting them in Japan time. `backend/route_providers/transit_provider.py` resolves station/stop endpoints only for conservative normalized-name matches and otherwise keeps the geographic `geo:` endpoint. The existing RouteSegment schema already represents `WALK`; the travel-plan serializer and route timeline preserve and render its fields.

## Goals / Non-Goals

**Goals:**

- Preserve Transit-provided access and egress walking in the common candidate's existing segment list.
- Reject invalid external walking data through the existing response conversion and HTTP 502 path.
- Keep journey legs, route-level metrics, endpoint resolution, and stored route contracts stable.

**Non-Goals:**

- Change endpoint lookup, name matching, or geographic routing behavior.
- Add walking estimates, geometry, a new segment type, API fields, Firestore fields, or UI components.
- Change candidate-level `walk_minutes`, waiting-time calculations, or route-search error handling.

## Decisions

1. **Build access/egress segments inside the existing option converter.** Read the optional values from `journey`, and construct segments with the same keys as existing `WALK` segments: `type: WALK`, endpoint names, formatted times, rounded-up duration, and null line/mode-specific fields. Prepend access and append egress around the parsed legs. A separate segment schema or frontend-specific representation would duplicate existing contracts without adding behavior.

2. **Use journey times, not adjacent leg durations, as the segment boundaries.** Access runs from `departureSecs` to `departureSecs + accessWalkSecs`; egress runs from `arrivalSecs - egressWalkSecs` to `arrivalSecs`. This leaves any gap before/after adjacent legs as waiting time and does not extend the walk. Adjacent stop names come from the first leg's `from.name` and last leg's `to.name`; the candidate's existing origin/destination values are the Places-derived labels.

3. **Validate before adding an external segment.** Treat missing values and zero as no external walk. For present values, require a finite, non-boolean number greater than or equal to zero. Require the total access-plus-egress seconds to fit both `journey.durationSecs` and the `arrivalSecs - departureSecs` interval. For each positive value, require the corresponding first/last leg and a nonblank stop name. Raise `RoutesResponseError` for invalid or unbuildable data; the current route-search boundary maps service response errors to HTTP 502. Do not turn malformed values into zero or silently skip a requested segment.

4. **Leave endpoint normalization and aggregate metrics untouched.** Only explicit Transit access/egress fields create these segments; proximity does not. A successfully snapped station/stop with absent or zero external-walk values therefore gains no synthetic segment. Keep `walk_minutes` sourced from `metrics.walkSecs` without adding either external seconds, since the metric may already include them.

5. **Use a focused local fixture and converter tests.** Add deterministic access/egress test data based on a geographic origin and destination with station legs. Cover each side independently and together, field omission/zero, segment order and times, a post-walk wait gap, aggregate metric preservation, malformed values, missing adjacent stop names, and the existing station-snap behavior. Keep tests independent of the live Transit API.

## Risks / Trade-offs

- [Transit may report walk seconds that exceed its own journey interval or duration] → Reject the response rather than display a segment with impossible timing; the existing service error path returns HTTP 502.
- [Route-level `walk_minutes` may already include access/egress walking] → Preserve the current `metrics.walkSecs` conversion and verify no second addition in tests.
- [A station/stop route may contain no external walking fields] → Generate segments only from explicit positive Transit values, leaving endpoint resolution unchanged.

## Migration Plan

No API or Firestore migration is required. Deploy the converter change with its tests; the existing response and travel-plan serializers carry the additional segments. Rollback is a code revert and requires no data cleanup because segment shape and storage fields remain unchanged.
