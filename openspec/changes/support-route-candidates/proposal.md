## Why

PlanRail currently returns only the first public-transit route, so users cannot compare alternatives before registering travel for an event. This change uses Transit guidance-plan's ranked options to present up to three routes, while extending the saved route details enough to reproduce the selected itinerary later.

## What Changes

- Request up to three balanced arrival itineraries and preserve Transit option order; do not add an independent ranking algorithm or request extra options to replace filtered ones.
- Return up to three public-transit candidates, identify the recommended candidate when Transit supplies one, and include mapped user-facing coverage warnings.
- Extend candidate comparison data and transit segment details with nullable fare, transfer, walking, waiting, train, platform, route color, and headway fields.
- Show up to three route summary cards, allow one active candidate at a time, and show only that candidate in the existing route timeline before registration.
- Save only the explicitly selected candidate, using an allowlisted PlanRail route shape that excludes unselected candidates, Transit ranking metadata, warnings, and geometry.
- Keep one travel plan per event; registering a different candidate for the same event replaces the existing travel plan.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `places-and-route-search`: change route search from one route to up to three comparable public-transit candidates, with candidate selection, recommendation, and coverage warnings.
- `travel-plans`: persist and display the selected candidate's expanded route and segment details while keeping one travel plan per event and excluding search-only data.

## Impact

- Backend: Transit request parameters and response conversion, route-search response models, warning mapping, and provider-independent tests.
- Frontend: route-search response handling, candidate comparison and selection UI, selected-route registration, and saved route detail rendering.
- Firestore: selected travel-plan documents gain explicitly defined candidate and segment fields; no collection or document-key change.
- Documentation: update route-provider and architecture guidance for the new API and persistence contract.
- External API: Transit `GET /api/v1/guidance/plan`; verify parameter and response details against the official OpenAPI document during implementation.

## Explicit Non-Goals

- Google Routes walking searches, replacing Transit walking legs, maps, geometry, or Google Maps fallback.
- More than three displayed candidates, user-configurable search options, or PlanRail-owned ranking.
- A visual redesign beyond a compact candidate comparison and reuse of the existing route timeline.
- Persisting unselected candidates, coverage warnings, ranking metadata, Transit raw responses, or geometry.
