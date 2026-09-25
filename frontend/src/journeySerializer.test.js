import assert from "node:assert/strict";
import test from "node:test";
import {
  journeyDisplayName,
  journeyMatchesDate,
  serializeJourney,
} from "./journeySerializer.js";

test("serializeJourney stores only completed section fields", () => {
  const serialized = serializeJourney({
    event_id: "event-1",
    target: {
      destination: {
        name: "会場",
        address: "住所",
        place_id: "place-1",
        lat: 33.5,
        lng: 130.4,
        types: ["university"],
      },
      arrival_deadline: "2026-10-01T12:00",
    },
    departure_at: "2026-10-01T10:00",
    arrival_at: "2026-10-01T12:00",
    sections: [
      {
        kind: "FIXED",
        origin: { name: "博多", lat: 33.5, lng: 130.4 },
        destination: {
          name: "会場",
          place_id: "place-1",
          lat: 33.5,
          lng: 130.4,
        },
        departure_at: "2026-10-01T10:00",
        arrival_at: "2026-10-01T12:00",
        label: "のぞみ",
        candidate_id: "must-not-persist",
      },
    ],
  });

  assert.equal(serialized.event_id, "event-1");
  assert.equal(serialized.sections[0].label, "のぞみ");
  assert.equal("candidate_id" in serialized.sections[0], false);
  assert.deepEqual(serialized.target.destination.types, ["university"]);
});

test("journeyDisplayName uses event, target, then fixed destination", () => {
  assert.equal(
    journeyDisplayName({ event_id: "e1", sections: [] }, { title: "発表" }),
    "移動: 発表",
  );
  assert.equal(
    journeyDisplayName({ target: { destination: { name: "自宅" } }, sections: [] }),
    "移動: 自宅",
  );
  assert.equal(
    journeyDisplayName({ sections: [{ destination: { name: "新大阪" } }] }),
    "移動: 新大阪",
  );
});

test("serializeJourney accepts a standalone fixed-only journey", () => {
  const journey = serializeJourney({
    event_id: null,
    target: null,
    departure_at: "2026-10-01T08:00",
    arrival_at: "2026-10-01T10:00",
    sections: [
      {
        kind: "FIXED",
        origin: { name: "博多" },
        destination: { name: "新大阪" },
        departure_at: "2026-10-01T08:00",
        arrival_at: "2026-10-01T10:00",
        label: "のぞみ",
      },
    ],
  });

  assert.equal(journey.target, null);
  assert.equal(journey.sections[0].kind, "FIXED");
});

test("serializeJourney rejects an Event-linked fixed section that misses its target", () => {
  assert.throws(
    () =>
      serializeJourney({
        event_id: "event-1",
        target: {
          destination: { name: "会場", place_id: "target-place", lat: 33.5, lng: 130.4 },
          arrival_deadline: "2026-10-01T12:00",
        },
        departure_at: "2026-10-01T10:00",
        arrival_at: "2026-10-01T11:00",
        sections: [
          {
            kind: "FIXED",
            origin: { name: "博多" },
            destination: { name: "別の場所", place_id: "other-place", lat: 33.6, lng: 130.5 },
            departure_at: "2026-10-01T10:00",
            arrival_at: "2026-10-01T11:00",
          },
        ],
      }),
    /目的地に接続/,
  );
});

test("journeyMatchesDate keeps Japanese wall-clock day boundaries", () => {
  const journey = {
    departure_at: "2026-10-01T23:30",
    arrival_at: "2026-10-02T01:00",
  };
  assert.equal(journeyMatchesDate(journey, new Date(2026, 9, 1)), true);
  assert.equal(journeyMatchesDate(journey, new Date(2026, 9, 2)), true);
  assert.equal(journeyMatchesDate(journey, new Date(2026, 9, 3)), false);
});
