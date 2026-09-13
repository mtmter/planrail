import assert from "node:assert/strict";
import test from "node:test";
import { serializeTravelPlan } from "./travelPlanSerializer.js";

test("travel plan serialization preserves access and egress WALK segments", () => {
  const segments = [
    {
      type: "WALK",
      from: "津山中学校・高等学校",
      to: "津山",
      departure_at: "2026-08-25T08:54",
      arrival_at: "2026-08-25T09:09",
      duration_minutes: 15,
      line_name: null,
      mode: null,
      train_type: null,
      headsign: null,
      from_platform: null,
      to_platform: null,
      color: null,
      headway_based: null,
    },
    {
      type: "TRANSIT",
      from: "津山",
      to: "岡山",
      departure_at: "2026-08-25T09:12",
      arrival_at: "2026-08-25T09:47",
      duration_minutes: 35,
      line_name: "JR津山線",
      mode: "rail",
      train_type: null,
      headsign: null,
      from_platform: null,
      to_platform: null,
      color: null,
      headway_based: false,
    },
    {
      type: "WALK",
      from: "岡山",
      to: "岡山県立図書館",
      departure_at: "2026-08-25T09:47",
      arrival_at: "2026-08-25T09:57",
      duration_minutes: 10,
      line_name: null,
      mode: null,
      train_type: null,
      headsign: null,
      from_platform: null,
      to_platform: null,
      color: null,
      headway_based: null,
    },
  ];
  const route = {
    origin: "津山中学校・高等学校",
    destination: "岡山県立図書館",
    departure_at: "2026-08-25T08:54",
    arrival_at: "2026-08-25T09:57",
    duration_minutes: 63,
    transport_mode: "TRANSIT",
    segments,
  };

  const saved = serializeTravelPlan("event-1", route);

  assert.equal(saved.event_id, "event-1");
  assert.deepEqual(saved.segments, segments);
});
