## Context

`ScheduleApp` in `frontend/src/App.jsx` owns `activeView`, `selectedDate`, loaded Events/Journeys/Preparations, a minute-updated `currentTime`, Event/Preparation mutations, and modal state. The same data is already projected into `calendarItems` for Event and Journey. `TimelineView` accepts `selectedDate` and callbacks; the in-progress `introduce-timeline-view` owns its internal ordering, route expansion, summary, and current-part styling. The in-progress `redesign-journey-builder-flow` owns `AddChoiceModal`'s Event/Journey tabs and `JourneyBuilderContent`.

The current month calendar has `min-width: 840px` inside `.calendar-horizontal-scroll`; the 7-column week grid also scrolls on narrow screens. At `max-width: 720px`, CSS stacks `.app-header` and shows `PreparationReminderList` above calendar content. At `min-width: 721px`, the sidebar holds `MiniCalendar` and reminders. `getPreparationReminders` filters to the configured reminder window; it cannot serve the proposed full preparation list. `PreparationChecklist` already toggles via `App.handleUpdatePreparation`. The current Standalone Journey form initializes `deadline` to an empty value and does not receive `AddChoiceModal.initialValues`.

Current canonical `schedule-management` still says three views and a two-choice header add action, while the active Timeline and Builder changes describe four desktop views and an add form with tabs; current code already contains the latter. This change assumes those active deltas when describing the mobile layer. Do not silently overwrite either active change or sync its planned behavior into canonical specs during this planning change.

## Goals / Non-Goals

**Goals:** Make the three mobile screens serve distinct jobs: Timeline for what happens and how to travel on one day; Calendar for when items occur across a month; Preparation for what remains before future Events. Keep calendar and addition separate. Reuse state, data, mutations, forms, detail dialogs, colors, typography, and UI primitives. Preserve the desktop experience.

**Non-Goals:** Change Timeline/Journey row or segment design; change Event/Journey/Preparation storage, search, or notifications; replace the PC calendar; add routing or deep links; create a new design system.

## Decisions

### 1. Separate presentation by the existing breakpoint

At 720px and below, render one of three mobile pages under a compact page-specific top bar and above a fixed bottom navigation. At 721px and above, keep the existing desktop header, sidebar, `MonthCalendar`, `WeekCalendar`, `DayCalendar`, and the Timeline view supplied by the active change. Use the same `ScheduleApp` data and mutation callbacks in both branches; do not mount duplicate data loaders or Firestore subscriptions. CSS and a `matchMedia('(max-width: 720px)')` state must agree on the boundary so a resize cannot expose a desktop view inside the mobile shell.

Keep `selectedDate` shared. Track the active desktop view and mobile tab separately: a newly mounted mobile session opens Timeline for today, and a newly mounted desktop session opens month for today. Resizing preserves `selectedDate` and the last view/tab in each mode rather than treating resize as a new login. The desktop view switch itself continues to preserve `selectedDate` as required by `introduce-timeline-view`. Mobile bottom navigation switches pages without changing `selectedDate`; calendar date selection and explicit date controls do change it. Neither tab selection nor initial mobile display creates or edits data.

Use existing button, surface, accent, Event/Journey color and AccountMenu styling where practical. The mobile top bar exposes account access on all three pages. The global error and loading states remain reachable; fixed controls and content account for bottom safe area and do not cover the last item. Give icon-only controls accessible names and mark the current tab; keep keyboard focus and touch targets usable.

### 2. Wrap the existing Timeline instead of changing its internals

The mobile Timeline page renders the existing `TimelineView` with the same `selectedDate`, `currentTime`, data, and detail/Builder callbacks. Above it, the page wrapper shows a local-date heading (`9月28日 月曜日`), seven adjacent dates centered on the selected day (three before and three after), and a `今日` button only when the selected day is not today. Date buttons include an accessible full date, weekday and selected state; dates spanning a month or year use `addDays`, `getDateKey`, `isSameDay`, and the existing local-date convention. A tap updates `selectedDate` without changing the tab. Existing Timeline content remains the authority for Event/Journey order, auto expansion, route presentation, summary, and empty state.

The desktop Timeline toolbar and internals stay governed by `introduce-timeline-view`. This change only supplies a mobile wrapper/navigation layer. Do not copy `JourneyTimeline` markup or move the preparation checklist into Timeline: the active Timeline delta deliberately shows Event preparation progress rather than an editable list.

### 3. Use a compact mobile month presentation

Build a mobile month component or equivalent presentation distinct from desktop `MonthCalendar`, backed by the existing `getMonthDates`, `eventOccursOnDate`, `calendarItems`, and date formatting. Render a Sunday-first 5/6-week grid within the available width without a fixed minimum width or horizontal page scroll. Each cell shows its date, Event/Journey presence using existing blue/orange cues, at most one legible truncated title when space allows, and `+N` for the remaining items. The item count includes Events and Journeys that overlap the day, including overnight items. Full names and item types remain available in the accessible date label. Do not squeeze the desktop item cards, full time grid, or popover into mobile cells.

The cell is one coherent date target: tapping its date, label, or `+N` sets `selectedDate` and changes to Timeline for that day. This avoids nested click targets with different actions. The mobile Calendar top bar shows the month, previous/next month, an explicit `今日` action, and AccountMenu. Month navigation sets `selectedDate` to the first day of the newly shown month (as the existing desktop month toolbar does); `今日` sets it to today. Thus the visible month and FAB default date always agree. Returning from Timeline opens the month containing the current `selectedDate`. Direct Event/Journey detail access remains available from Timeline after the date choice. Desktop month cell click and item/detail behavior remain unchanged.

### 4. Keep creation behind a mobile FAB

Show a fixed `＋` FAB on mobile Timeline and Calendar only, above the bottom navigation and safe area. Pressing it opens the existing single add flow with `予定 / 移動予定` tabs. Present the shell as a mobile-friendly sheet where practical, while retaining its existing tab contents, forms, validation, and one-dialog behavior. There is no intermediate two-button choice and no FAB on Preparation. Existing Event detail → Event-linked Journey Builder uses the current Event destination and arrival deadline unchanged.

Take a snapshot of `selectedDate` when opening the FAB. `AddEventModal` receives the existing editable 09:00–10:00 defaults for that date. Extend only the *new Standalone* Builder input to receive the same selected date for its editable arrival deadline, using the current `DateTimePicker` default time of 09:00; do not prefill a destination, origin, Event link, or fixed movement. Opening an existing Journey for edit or an Event-linked Builder continues to restore its saved/current target rather than applying the FAB date. Both Timeline and Calendar use the same snapshot, including after month navigation. The target date stays unchanged while the sheet is open even if underlying state changes. The 09:00 initial time is a UI default only, never an automatic saved Journey.

### 5. Derive the Preparation page from existing data

Derive eligible Event groups from already loaded Events and Preparations: parse each Event `start_at` in local time, require a valid start strictly later than `currentTime`, match Preparations by `event_id`, and keep only `completed === false`. Sort groups by Event start ascending, then Event ID for ties; retain each Event's preparation items in their existing order. The badge is the total number of these *items*, not the number of Events or only the items in the reminder window. A group disappears when its last item is checked or its Event ceases to be future. Orphaned items, past Events, and completed items are excluded. Empty state explains that no future preparation remains; when Preparations failed to load (`null`), show the existing failure/retry state and do not display a misleading zero or badge.

Use the existing reminder duration only to mark groups with `0 < start - now <= reminderMinutes` as `まもなく必要` using the existing warning/attention color. It does not filter the list or change the badge. Rely on the existing minute clock and focus/visibility refresh plus state updates to recalculate the list and highlight. A group's Event title opens `EventDetailsModal` in details mode. Item checkbox calls the existing `handleUpdatePreparation(eventId, preparationId, {title, completed: true})` path; preserve pending/error feedback and avoid double submission. Item editing, adding, and deleting remain in the existing Event detail checklist rather than creating a second CRUD surface.

Place a settings action in the Preparation top bar to open `PreparationReminderSettingsModal` with the same options and localStorage value. The modal's existing wording about when items begin appearing must be updated for this mobile use: the duration governs `まもなく必要` emphasis and existing desktop reminders, while the full mobile list stays visible. Remove the mobile top reminder block from Timeline and Calendar; keep the desktop sidebar reminder list and desktop settings placement.

## Risks / Trade-offs

- Seven narrow month columns cannot always fit meaningful titles. Prioritize date, item presence, count, and an accessible full label; verify both 5- and 6-week months at 320–720px and long Japanese names.
- `DateTimePicker` currently falls back to today when its value is empty. A mobile Standalone Journey must receive an explicit selected-day default so the chosen date is visible when the form opens.
- Bottom navigation, FAB, sheet, account popover, and keyboard can compete for viewport space. Check safe-area padding, scroll reachability, modal focus, and dismissal on representative phone sizes.
- The two active changes and this change touch `schedule-management`, especially view switching and add actions. Apply/review their accepted deltas together before canonical sync or archive, retaining desktop behavior and using this change's mobile-specific clauses. Do not copy Timeline/Journey internals into this change.
- The current canonical `schedule-management` / `preparations` text describes only the pre-change behavior. Those are intentional delta targets, not evidence that the active changes have been completed or archived.

## Open Questions

None blocking. The seven-day centered strip, one visible month title, month-navigation selection of day 1, and editable 09:00 Standalone deadline are scoped UI defaults chosen here; they do not alter saved data or the Timeline/Journey contracts.
