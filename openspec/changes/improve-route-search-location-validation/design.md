## Context

See [proposal.md](proposal.md) for motivation and [the delta spec](specs/places-and-route-search/spec.md) for the behavior contract. `EventDetailsModal` currently enables the route-search action when a place name or address exists, while `TravelPlanDetails` hides the action when no callback is passed. `RouteSearchModal` displays the saved destination as a summary and accepts only an origin; the backend independently validates route-search coordinates and returns HTTP 400 when required location data is missing.

## Goals / Non-Goals

**Goals:**

- Make the saved event's two destination coordinate fields the sole eligibility check for route-search actions.
- Keep the disabled action visible with an adjacent instruction when either coordinate is absent.

**Non-Goals:**

- Change place-entry or schedule-save behavior, destination editing in the route modal, backend validation, Transit requests, or Route JSON.
- Treat a Place ID or the fact that Autocomplete was used as a substitute for either coordinate.

## Decisions

- Derive eligibility in `EventDetailsModal` from the presence of both `event.destination_lat` and `event.destination_lng`, then pass the enabled state separately from the click handler to `TravelPlanDetails`. This keeps route-search availability tied to the saved event data, including when a travel plan already exists.
- Render the route-search action after travel-plan loading even when there is no saved travel plan or destination text. Disable it when coordinates are incomplete and show the specified guidance beside it. Keeping a disabled action visible makes the requirement and next step discoverable; hiding the action would not explain why search is unavailable.
- Leave `RouteSearchModal` and the API path unchanged. The existing backend HTTP 400 validation remains a defensive check for incomplete direct requests and missing origin data.

## Risks / Trade-offs

- Showing a disabled search action for events with no destination adds a control to the current empty state → Keep the existing “経路検索には予定の目的地が必要です” text and place the coordinate guidance next to the disabled action so both the missing destination and required step remain clear.
- Coordinates may be missing even when a place name is displayed → This is the intended distinction: names remain useful for display and saving, while route search requires both coordinates.

## Migration Plan

No data or API migration is needed. Deploy the frontend change with the normal application release; rollback consists of reverting the frontend presentation and eligibility change. Existing saved schedules remain readable and editable.

## Open Questions

None.
