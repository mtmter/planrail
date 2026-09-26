import assert from "node:assert/strict";
import test from "node:test";
import { getDateKey } from "./dateUtils.js";
import {
  getMobileCalendarDay,
  getMobileDateStripDates,
  getUpcomingPreparationGroups,
} from "./mobileScheduleModel.js";

test("mobile date strip crosses month and year boundaries around the selected day", () => {
  const dates = getMobileDateStripDates(new Date(2026, 11, 31));
  assert.deepEqual(dates.map(getDateKey), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
    "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
});

test("mobile month combines overnight Event and Journey counts and type cues", () => {
  const items = [
    { id: "event-1", itemType: "event", title: "夜の予定", start_at: "2026-10-01T23:30", end_at: "2026-10-02T00:30" },
    { id: "journey-1", itemType: "journey", title: "夜の移動", start_at: "2026-10-01T23:45", end_at: "2026-10-02T01:00" },
    { id: "event-2", itemType: "event", title: "朝の予定", start_at: "2026-10-02T09:00", end_at: "2026-10-02T10:00" },
  ];

  const day = getMobileCalendarDay(items, new Date(2026, 9, 2));
  assert.deepEqual(day.items.map((item) => item.id), ["event-1", "journey-1", "event-2"]);
  assert.equal(day.hasEvent, true);
  assert.equal(day.hasJourney, true);
  assert.equal(day.hiddenCount, 2);
});

test("mobile preparations include future items outside the reminder window and exclude ineligible items", () => {
  const now = new Date(2026, 9, 1, 9, 0);
  const events = [
    { id: "soon", title: "まもなく", start_at: "2026-10-01T09:30" },
    { id: "later", title: "後日", start_at: "2026-10-08T09:00" },
    { id: "started", start_at: "2026-10-01T09:00" },
    { id: "invalid", start_at: "2026-02-30T09:00" },
  ];
  const preparations = [
    { id: "later-1", event_id: "later", title: "後日の準備", completed: false },
    { id: "soon-1", event_id: "soon", title: "直前の準備", completed: false },
    { id: "done", event_id: "soon", title: "完了済み", completed: true },
    { id: "started-1", event_id: "started", completed: false },
    { id: "invalid-1", event_id: "invalid", completed: false },
    { id: "orphan", event_id: "missing", completed: false },
  ];

  const groups = getUpcomingPreparationGroups(events, preparations, 60, now);
  assert.deepEqual(groups.map((group) => [group.event.id, group.items.map((item) => item.id), group.isSoon]), [
    ["soon", ["soon-1"], true],
    ["later", ["later-1"], false],
  ]);
  assert.equal(groups.reduce((count, group) => count + group.items.length, 0), 2);
  assert.equal(getUpcomingPreparationGroups(events, null, 60, now), null);
});
