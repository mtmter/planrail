## 1. Transit fixture and segment conversion

- [x] 1.1 Add a deterministic guidance-plan fixture for a geographic facility origin, a `津山 → 岡山` transit leg, and optional external access/egress seconds; verify the fixture loads in the backend converter tests without network access.
- [x] 1.2 Convert validated positive `accessWalkSecs` and `egressWalkSecs` into existing `WALK` segments around unchanged journey legs; verify endpoint labels, exact journey-based times, rounded-up duration, null transport-specific fields, and segment ordering with focused converter tests.
- [x] 1.3 Verify missing/zero values add no external segments, one-sided and two-sided cases work, waiting gaps remain outside walk durations, and `metrics.walkSecs` is not double-counted; run the focused converter tests.

## 2. Error and compatibility checks

- [x] 2.1 Reject negative, nonnumeric, non-finite, or journey-inconsistent access/egress values and positive values without the required adjacent stop name; verify converter response errors and the existing HTTP 502 route-search mapping.
- [x] 2.2 Verify station/stop endpoint resolution still requires the existing normalized name match and creates no inferred walk when Transit supplies no positive access/egress seconds; run the existing endpoint-resolution regression tests.
- [x] 2.3 Verify the RouteCandidate and RouteSegment key sets remain unchanged and the new segments pass through existing travel-plan serialization and route display; run backend unittest discovery plus frontend lint and build.
