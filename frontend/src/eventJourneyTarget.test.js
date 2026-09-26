import assert from "node:assert/strict";
import test from "node:test";
import { eventJourneyTargetChanged, getEventDestination, hasSearchableDestination } from "./eventJourneyTarget.js";

const event = {
  start_at: "2026-09-26T12:00", arrival_buffer_minutes: 30,
  destination_place_id: "place-a", destination_lat: 35, destination_lng: 139,
  destination: "住所", location_name: "会場",
};

test("target stable edits preserve linked Journey", () => {
  assert.equal(eventJourneyTargetChanged(event, { ...event, title: "新しい名前", description: "説明", end_at: "2026-09-26T15:00" }), false);
  assert.equal(eventJourneyTargetChanged(event, { ...event, location_name: "表示名変更", destination: "新しい表示住所" }), false);
  assert.equal(eventJourneyTargetChanged(event, { ...event, start_at: "2026-09-26T12:10", arrival_buffer_minutes: 40 }), false);
});

test("destination, deadline and coordinate loss invalidate linked Journey", () => {
  assert.equal(eventJourneyTargetChanged(event, { ...event, destination_place_id: "place-b" }), true);
  assert.equal(eventJourneyTargetChanged(event, { ...event, start_at: "2026-09-26T12:10" }), true);
  assert.equal(eventJourneyTargetChanged(event, { ...event, arrival_buffer_minutes: 40 }), true);
  assert.equal(eventJourneyTargetChanged(event, { ...event, destination_lat: null }), true);
  assert.equal(hasSearchableDestination({ ...event, destination_lat: null }), false);
  assert.equal(getEventDestination({ ...event, destination_lat: null }), null);
});

test("legacy places without ids follow coordinates and address", () => {
  const legacy = { ...event, destination_place_id: null };
  assert.equal(eventJourneyTargetChanged(legacy, { ...legacy, location_name: "別名" }), false);
  assert.equal(eventJourneyTargetChanged(legacy, { ...legacy, destination: "別住所" }), true);
  assert.equal(eventJourneyTargetChanged(legacy, { ...legacy, destination_lat: 36 }), true);
});
