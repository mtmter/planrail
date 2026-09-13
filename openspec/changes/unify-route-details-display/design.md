## Context

See [proposal.md](proposal.md) for motivation and scope. Change 1 (Transit APIへの移行) and Change 2 (最大3候補比較・Routeモデル拡張) are archived and their behavior is present in the current specs and code.

`RouteSearchResult` currently owns the candidate cards, warnings, selected-route summary, vertical timeline, and registration controls. Its selected route display includes route departure/arrival and duration, origin/destination, segment type and line, duration, endpoints, segment times, and available transit labels. `TravelPlanDetails` separately formats the saved route summary and segments; it displays available metrics and optional transit labels, but does not display per-segment departure and arrival times. Firestore persistence already stores the same Route fields through an allowlist. Frontend `package.json` has no test script or test framework.

## Goals / Non-Goals

**Goals:**

- Render the details of one Route through a single presentational component in both search results and saved travel plans.
- Preserve the current search-result candidate, warning, selection, retry, and registration behavior.
- Keep saved travel-plan metrics compact and retain its title, loading/empty states, and re-search action.
- Tolerate absent optional fields and old or missing segment data while rendering available core Route information.

**Non-Goals:**

- Changing the route API, Transit requests, Firestore shape or serializer, candidate logic, or route-search controls.
- Adding a frontend test framework, route migration, new visual design system, map, geometry, animations, or new transport icons.

## Decisions

### Extract only the one-Route detail view

Create a focused shared `RouteDetails`-style component that accepts one route object and renders its overall time/duration summary plus the vertical origin-to-destination segment timeline. Move the existing search timeline presentation into this component so the search screen retains its current appearance and information. Reuse that exact component in `TravelPlanDetails` rather than reproducing the timeline or rendering the whole `RouteSearchResult` there.

Keep candidate cards, recommendation and warning presentation, selected-candidate state, error display, retry, and registration outside the shared component in `RouteSearchResult`. Keep the travel-plan heading, compact route metrics, loading/empty state, and re-search action in their current parent/modal responsibilities. This boundary shares only the details of one route and does not couple either flow's controls to the other.

An alternative is to add missing timestamps and fields to the existing saved-plan layout. That would preserve duplicate rendering logic and allow the two route views to diverge again. Reusing all of `RouteSearchResult` would instead pull search-only behavior into a saved-plan view that has no candidate selection or registration step.

### Make route detail rendering tolerant of saved data

The shared view treats `segments` as a list only when it is an array. It renders optional labels only when their values are present, including explicit handling of nullable booleans so `headway_based: false` remains visible. Missing segment fields must not prevent display of other fields, endpoints, or the route-level summary. When segments are missing or empty, show available route endpoints and do not fabricate segment times or details. Preserve usable legacy segment values without adding normalization writes or a Firestore migration.

Do not add `color` as a new colored treatment; continue to tolerate its presence in saved data. Continue using existing time and transit-label formatters where applicable. Preserve button semantics for route actions and the current heading hierarchy in each parent.

An alternative is to require every segment and optional field to be present before rendering a timeline. This would hide useful data from older saved routes and conflict with the existing nullable Firestore contract.

### Keep route metrics at the saved-plan boundary

Render `transfer_count`, `walk_minutes`, `wait_minutes`, and fare as a compact summary in `TravelPlanDetails`; use the existing fare formatter so IC fare retains priority over ticket fare. Search candidate summary cards remain unchanged and continue to own their comparison presentation. The shared route detail component focuses on the common whole-route and segment timeline.

### Keep the spec delta limited to saved-plan behavior

The existing `places-and-route-search` requirements already require the selected candidate's vertical route timeline and unchanged search actions. The observable addition in this change is the detail shown for a saved travel plan, so only `travel-plans` receives a spec delta. The implementation and verification tasks still guard the existing search presentation against regressions.

## Risks / Trade-offs

- [Extracting styles may subtly change the search result appearance] → Reuse the existing route summary/timeline class structure and compare search display before and after with the same route data.
- [Older saved data may have incomplete or unusual segment fields] → Guard each optional field independently, handle absent segment arrays, and manually verify a sparse legacy-shaped route alongside a fully populated route.
- [No frontend automated test runner exists] → Do not introduce one for this change; run lint/build and perform the listed manual acceptance checks.

## Migration Plan

No data migration or backend rollout is needed. Deploy the frontend-only presentation change. Roll back by reverting that frontend release if the shared view fails to render saved routes; the Firestore documents and API contract remain unchanged.

## Open Questions

None. The common view is limited to one Route's shared summary and timeline; search and saved-plan controls remain with their current parent flows.
