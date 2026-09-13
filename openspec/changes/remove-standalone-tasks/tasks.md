## 1. Remove standalone task state and persistence

- [x] 1.1 Remove task state, selected-task state, task loading/CRUD handlers, task view and modal references from `App.jsx`; verify no task tab, list, detail, completion, or CRUD interaction remains in the UI.
- [x] 1.2 Update `loadScheduleData` to read and return only events and preparations, and remove task CRUD from `firestoreService.js`; verify the frontend has no task collection reads/writes or task CRUD exports, and existing task documents are not deleted or migrated.
- [x] 1.3 Convert the shared add modal into an event-only form (rename it `AddEventModal` if that remains the natural component boundary); verify the header add button always opens event creation with the existing month/week/day date and time defaults.
- [x] 1.4 Remove task-specific date helpers and delete `TaskList` and `TaskDetailsModal`; verify no active frontend imports, callbacks, or task-only utilities/styles remain.

## 2. Keep calendar views event-only

- [x] 2.1 Remove task filtering/rendering and task popover data from `MonthCalendar`; verify daily visibility limits, hidden-item counts, and the overflow list are based only on events.
- [x] 2.2 Remove due-task rows, overflow popups, task props, and task click handlers from `WeekCalendar` and `DayCalendar`; verify only event blocks appear on their time axes and the day view has no due-task area.
- [x] 2.3 Remove task-only CSS while retaining shared event and calendar styles; verify month, week, and day layouts still render and event interactions remain usable.

## 3. Preserve preparations and related behavior

- [x] 3.1 Keep preparation checklist CRUD, reminder calculation, and reminder settings unchanged while removing the task-view layout condition; verify the reminder appears in the desktop sidebar at widths of 721px or more and at the top at widths of 720px or less.
- [x] 3.2 Verify preparation items can still be added, edited, deleted, and marked complete, and that reminder settings and reminder dismissal after completing all preparation items continue to work.
- [x] 3.3 Regression-check event creation/edit/deletion, route search, and travel-plan registration/display; run `backend/.venv/bin/python -m unittest discover -s backend -p 'test_*.py'` and confirm route-search behavior remains unchanged.

## 4. Align product documentation and specifications

- [x] 4.1 Update README, `docs/architecture.md`, and the login-screen product description to remove standalone-task claims and describe only the remaining Firestore collections; verify user-facing and architecture documentation no longer presents tasks as a current feature.
- [x] 4.2 Apply the four change deltas to current specs during sync/archive; verify `schedule-management`, `authentication-and-persistence`, `preparations`, and `travel-plans` no longer describe task functionality and still preserve preparation and travel-plan behavior.

## 5. Run frontend verification

- [x] 5.1 Run `cd frontend && npm run lint && npm run build`; verify both commands complete successfully after the task-only code and styles are removed.
