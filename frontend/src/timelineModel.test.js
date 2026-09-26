import assert from "node:assert/strict";
import test from "node:test";
import { focusedJourney, formatRelativeTime, timelineItems, timelineJourneyName } from "./timelineModel.js";

const day = new Date(2026, 8, 26);
const journey = (id, departure_at, arrival_at) => ({ id, departure_at, arrival_at, sections: [] });

test("timeline includes overlapping events and journeys in stable order", () => {
  const events = [{ id: "e", start_at: "2026-09-25T23:30", end_at: "2026-09-26T06:40" },
    { id: "f", start_at: "2026-09-26T23:30", end_at: "2026-09-27T00:30" }];
  const journeys = [journey("j", "2026-09-25T23:00", "2026-09-26T02:00"),
    journey("k", "2026-09-26T23:30", "2026-09-27T06:40")];
  assert.deepEqual(timelineItems(events, journeys, day).map((item) => item.id), ["j", "e", "f", "k"]);
  assert.equal(formatRelativeTime(journeys[0].departure_at, day), "前日 23:00");
  assert.equal(formatRelativeTime(journeys[1].arrival_at, day), "翌日 06:40");
});

test("focus picks active by arrival, departure and ID then next departure", () => {
  const items = timelineItems([], [
    journey("b", "2026-09-26T10:00", "2026-09-26T12:00"),
    journey("a", "2026-09-26T10:00", "2026-09-26T12:00"),
    journey("c", "2026-09-26T09:50", "2026-09-26T12:00"),
    journey("d", "2026-09-26T12:00", "2026-09-26T13:00"),
  ], day);
  assert.deepEqual(focusedJourney(items, day, new Date(2026, 8, 26, 10, 0)), { journey: items.find((item) => item.id === "c"), status: "active" });
  assert.equal(focusedJourney(items.filter((item) => item.id !== "c"), day, new Date(2026, 8, 26, 10, 0)).journey.id, "a");
  assert.equal(focusedJourney(items, day, new Date(2026, 8, 26, 12, 0)).journey.id, "d");
  assert.equal(focusedJourney(items, day, new Date(2026, 8, 26, 13, 0)), null);
  assert.equal(focusedJourney(items, new Date(2026, 8, 27), new Date(2026, 8, 26, 10)), null);
});

test("timeline names do not alter detail titles", () => {
  const linked = { event_id: "e", target: { destination: { name: "会場" } } };
  assert.equal(timelineJourneyName(linked, { title: "打合せ" }), "打合せへ");
  assert.equal(timelineJourneyName({ target: { destination: { name: "駅" } } }), "駅へ移動");
  assert.equal(timelineJourneyName({ target: null, sections: [{ destination: { name: "宿" } }] }), "宿へ移動");
});
