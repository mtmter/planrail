import assert from "node:assert/strict";
import test from "node:test";
import { eventOccursOnDate, getEventDaySegment, getEventPositionForDay } from "./dateUtils.js";
import { getEventArrivalDeadline } from "./eventJourneyTarget.js";

test("Journey calendar clips overnight intervals to each Japanese wall-clock day", () => {
  const journey = { start_at: "2026-03-08T23:30", end_at: "2026-03-09T01:15" };
  const firstDay = new Date(2026, 2, 8);
  const secondDay = new Date(2026, 2, 9);
  assert.equal(eventOccursOnDate(journey, firstDay), true);
  assert.equal(eventOccursOnDate(journey, secondDay), true);
  assert.deepEqual(getEventPositionForDay(journey, firstDay), { startMinutes: 1410, durationMinutes: 30 });
  assert.deepEqual(getEventPositionForDay(journey, secondDay), { startMinutes: 0, durationMinutes: 75 });
  assert.deepEqual(getEventDaySegment(journey, secondDay), { continuesBefore: true, continuesAfter: false });
  assert.equal(eventOccursOnDate(journey, new Date(2026, 2, 10)), false);
});

test("Event deadline subtraction uses wall-clock minutes across midnight", () => {
  assert.equal(getEventArrivalDeadline({ start_at: "2026-03-09T00:10", arrival_buffer_minutes: 30 }), "2026-03-08T23:40");
});
