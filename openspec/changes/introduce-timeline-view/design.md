## Context

See `proposal.md` for motivation and `specs/timeline-view/spec.md` for the behavior contract. At local `main` HEAD `6817aba`, `App.jsx` owns `activeView`, `selectedDate`, Event/Journey/Preparation data, modal selection, and a one-minute `currentTime` updated on focus/visibility. `CalendarToolbar` already provides previous/today/next; the day view uses `addDays`, `formatDayTitle`, and `handleCalendarDateChange`. `calendarItems` already projects each Journey as an independent item with `start_at`/`end_at` and `itemType`.

`DayCalendar`/`WeekCalendar` filter overlaps with `eventOccursOnDate` and clip visible blocks with `getEventPositionForDay`; `journeyMatchesDate` separately verifies wall-clock day overlap. `JourneyTimeline` is shared by Builder preview and Journey details; its embedded `RouteDetails` uses `RoutePlace`, `RouteTimeSummary`, `route-timeline`, and route segment CSS for route details. `JourneyDetailsModal` and `EventDetailsModal` are existing shells. `PreparationReminderList` currently appears in the sidebar on desktop and at the top on mobile. Event detail owns `PreparationChecklist` and its in-dialog `JourneyBuilderContent` mode.

One pre-existing date behavior differs from the canonical `schedule-management` wording: when switching from month to week, `App.jsx` replaces `selectedDate` with today or the first of the selected month. Timeline entry/exit will preserve the selected date without changing that existing month→week path; the inconsistency should be reconciled separately rather than silently changed by this feature.

The in-progress `redesign-journey-builder-flow` delta describes the input/search/preview and edit flow visible in current code. Its `tasks.md` leaves real Places/Transit and authenticated Firestore browser acceptance partly unverified. The canonical `journeys` spec still describes section-by-section Builder search, while current main and the in-progress delta use one action to search all gaps. This change does not resolve that unrelated spec/code mismatch or sync the in-progress change. Remote `origin/main` could not be queried from this environment; this design is grounded in the checked-out local `main` and its identical local `origin/main` ref.

## Goals / Non-Goals

**Goals:** Add a single-column day agenda with a clear in-place route view, preserve the current Journey visual language and existing data contract, and keep action wiring inside the existing App/Event/Journey flows.

**Non-Goals:** New route-search or preparation CRUD, a new Journey title field, new modal shell, persistent focus state, 24-hour positioned time rail, a global mobile navigation redesign, backend or Firestore changes. Product non-goals are listed in `proposal.md`.

## Decisions

### 1. Integrate with App state and the existing date navigation

Add `timeline` to `activeView` and render one `TimelineView` from `App.jsx`. It receives the shared `selectedDate`, raw items or the existing Journey projection, `preparations`, `currentTime`, and callbacks into the existing details/Builder/add flows. Render the same `CalendarToolbar` as day view using `formatDayTitle`, `addDays(±1)`, and `handleCalendarDateChange`. Treat Timeline as a day when choosing default dates in the global add flow. Keep month/week/day behavior and their toolbar unchanged.

Alternative considered: a separate Timeline date state and navigation. It would make switching views surprising and duplicate day navigation.

### 2. Reuse day-overlap semantics and sort stable independent items

Build a display projection with explicit Event/Journey type and original IDs. Filter both with the existing `eventOccursOnDate` interval rule over `start_at`/`end_at`; use `journeyMatchesDate` as an existing consistency check/test reference rather than a second Timeline-only rule. The same wall-clock `YYYY-MM-DDTHH:mm` values govern comparison and `parseDateTime`; do not parse them as UTC instants for the focus decision. Sort by the visible start (`max(item.start_at, selected-day 00:00)`), then actual start, type, and ID for stable ties. A preceding-day item appears at the beginning of the selected day but retains its full original times. Keep linked Journey as a sibling of Event, with a subtle relationship marker or adjacent text; do not nest the route card under Event.

For today's separator, classify an item as past only when its effective end is `<= now`; otherwise it belongs after “現在”. Sort within each group by visible start. Overlapping items can therefore cross the boundary without implying that an ongoing item is finished. Show the separator between the groups even when one side is empty; omit it on other days. An absolute vertical time rail would be misleading for uneven route content and is unnecessary.

Alternative considered: sorting solely by starts and inserting the separator at the first future start. That puts an ongoing overnight Journey above the separator and can label it visually as past. Grouping by temporal status keeps the boundary meaningful.

### 3. Derive one automatic Journey; keep manual expansion separate

For today only, derive `focusedJourneyId` from Journey data and `currentTime` on each render. Choose an active interval (`departure_at <= now < arrival_at`) first; if multiple overlap, choose earliest arrival, then earliest departure and ID for deterministic behavior. Otherwise choose the nearest strictly future departure, using ID as a tie breaker. Do not choose ended Journeys. Keep manually expanded IDs in local view state so multiple nonfocused Journeys can stay open; reset that state when the selected date changes. The effective expanded state is automatic focus OR manual selection. An automatic focus changes as the minute clock advances; manual expansions need not close at that transition. The internal variable name is never rendered.

Alternative considered: saving an “active” Journey or letting a click mutate which Journey is focused. Current data has no execution state, and focus here only guides presentation.

### 4. Embed the common Journey route presentation

Render a compact header for each Journey with natural Event/destination name, original departure/arrival times, origin/destination, and available aggregate metrics. The automatically expanded item also shows “次の移動” with time until departure or “移動中” with expected arrival. Use App's existing minute-updated `currentTime` and its focus/visibility refresh. The calculation is a countdown to scheduled times, not transit tracking.

For every expanded Journey, render the saved `sections` with `JourneyTimeline` directly, preserving its `RouteTimeSummary`, `RoutePlace`, embedded `RouteDetails`, and existing `route-timeline`/`route-segment` styling. The existing component already renders WALK/TRANSIT, line/headsign/stops/platform if present, FIXED as “固定移動”, and waits. If a compact/embedded or summary prop is needed, extend the shared component minimally; never copy its markup into a Timeline-specific route component. Add relative-day labeling to shared time formatting/presentation so both summary and section times remain intelligible across midnight; preserve the complete stored timestamps and duration. A small header plus the existing route timeline avoids a second “ROUTE 1/2” card hierarchy.

Only show saved data. Aggregate transfers/walk time when the source values support a truthful total, otherwise omit them. Do not turn missing values into zero. Keep the existing stale Event target/replan warning behavior visible or reachable when a linked Journey's target differs from its Event; never silently substitute current Event destination for the stored route endpoint.

Alternative considered: a new Journey-specific Timeline rail and route cards. That would drift from Builder preview and Journey detail and increase narrow-width risk.

### 5. Reuse details and edit flows through callbacks

Event item selection calls the existing `setSelectedEvent` path. Journey “詳細” calls `setSelectedJourney`; “経路を再検索/再計画” passes the saved Journey into `editingJourney` and the existing `JourneyBuilderModal` edit mode. For a linked Journey, pass its current Event as App already does; the Builder's current-target/dirty behavior remains authoritative. An Event without a linked Journey opens its `EventDetailsModal` directly in existing route mode via a small initial-mode prop or equivalent App callback, rather than creating a second Builder dialog. The Event target remains read-only in Builder. Omit the action for an Event that is no longer future, has a linked Journey, or lacks searchable coordinate data; for missing coordinate data, show a short plain-language hint.

Alternative considered: adding route inputs or another modal to Timeline. It would duplicate validation and risk double backdrop/dialog rendering.

### 6. Place preparations inside Event items and preserve the rest of the app

Count the already loaded `preparations` by `event_id` and `completed`. Display progress only when the collection loaded and the Event has items. Keep Event title/start, optional end/place, and a click target to Event detail; do not render the checklist or description in Timeline. Suppress `PreparationReminderList` in both top and sidebar positions only while Timeline is active, avoiding a second reminder block above the integrated Event progress. Preserve the existing reminder settings and placement for month/week/day. Continue to show the existing preparation-load error and avoid treating null as zero.

Alternative considered: placing the existing reminder list above Timeline. It repeats Event information and competes with the focused route.

### 7. Keep narrow layouts within the existing design system

Use existing typography, spacing, colors, buttons, `selected-place-card` conventions where applicable, Event/calendar item cues, and `route-timeline` styles. Constrain the Timeline body to a readable centered max-width on desktop and one flexible column with `min-width: 0`, wrapping names and route details on mobile. The existing calendar grid can still scroll horizontally in month/week/day; Timeline must not depend on horizontal scrolling. The existing header and mobile navigation remain as they are.

Alternative considered: a two-column dashboard. It would separate the day's sequence from its route and complicate the later mobile-first direction.

## Risks / Trade-offs

- [Existing route typography may overflow on narrow screens] → Check the shared `RouteTimeSummary`, `RoutePlace`, route detail rows, and button wrapping at mobile widths; fix their shared layout only where necessary.
- [Automatic focus may change while a user reads another Journey] → Derive focus from time without clearing manual expansions; use a stable ID tie rule and verify minute/focus/visibility transitions.
- [Overnight intervals and DST-sensitive parsing can diverge] → Use existing wall-clock date helpers, preserve stored full timestamps, and test selected-day overlap, original times, relative-day labels, and minute boundary cases.
- [A linked Event can change after its Journey was saved] → Keep Journey sections as saved, preserve the existing replan warning semantics, and route edits through Builder using the current Event target.
- [The in-progress Builder change has incomplete live acceptance checks] → Verify Timeline's Event-linked create and saved-Journey edit flows against real authenticated data during implementation; do not claim those checks are complete in this planning change.

## Migration Plan

No data migration. The change is additive in frontend presentation; rollback removes the Timeline tab and view while leaving saved Event, Journey, and Preparation documents untouched.
