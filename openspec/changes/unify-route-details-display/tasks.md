## 1. Shared Route detail display

- [x] 1.1 Extract the selected Route's overall time/duration summary and vertical segment timeline into one focused shared component; verify the search view retains its existing origin, destination, segment labels, times, and timeline structure.
- [x] 1.2 Make shared rendering tolerate absent optional fields and missing/empty legacy segment lists while preserving available values, including `headway_based: false`; verify sparse Route data still shows its available summary and segment details.

## 2. Integrate both Route views

- [x] 2.1 Use the shared component for the active candidate in `RouteSearchResult`, keeping candidate cards, recommended badge, warnings, candidate selection, retry, error, and registration controls in the search flow; verify candidate switching still changes the displayed and registered Route.
- [x] 2.2 Replace the independent route summary/timeline in `TravelPlanDetails` with the same shared component, keep transfer/walk/wait/fare as a compact summary, and preserve the section heading, loading/empty states, and re-search action; verify search-only UI does not appear for a saved Route.

## 3. Integration verification

- [x] 3.1 Manually verify a fully populated saved plan displays overall and per-segment departure/arrival times, line name, mode, train type, headsign, platforms, headway status, transfer count, walking time, waiting time, and fare; verify absent/null fields and an old or segment-less saved plan remain displayable without migration.
- [x] 3.2 Manually verify route search still supports candidate switching and registration, the saved-plan re-search action still works, and the detail timeline remains visually consistent across both views.
- [x] 3.3 Run `cd frontend && npm run lint && npm run build`; do not introduce a frontend test framework for this change.
