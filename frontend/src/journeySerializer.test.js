import assert from "node:assert/strict";
import test from "node:test";
import {
  journeyDisplayName,
  journeyMatchesDate,
  isJourneyDateTime,
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

test("save boundary rejects invalid dates, route fields, and section gaps", () => {
  assert.equal(isJourneyDateTime("2026-02-30T25:61"), false);
  const route = {
    origin: "自宅", destination: "会場",
    departure_at: "2026-10-01T10:00", arrival_at: "2026-10-01T10:30",
    duration_minutes: 30, transport_mode: "transit",
    segments: [{ type: "TRANSIT", from: "自宅", to: "会場",
      departure_at: "2026-10-01T10:00", arrival_at: "2026-10-01T10:30",
      duration_minutes: 30 }],
  };
  const origin = { name: "自宅", place_id: "origin", lat: 33.5, lng: 130.5 };
  const destination = { name: "会場", place_id: "venue", lat: 33.6, lng: 130.6 };
  const journey = {
    event_id: null,
    target: { destination, arrival_deadline: "2026-10-01T11:00" },
    departure_at: route.departure_at, arrival_at: route.arrival_at,
    sections: [{ kind: "ROUTE", origin, destination, route }],
  };
  assert.doesNotThrow(() => serializeJourney(journey));
  assert.throws(() => serializeJourney({ ...journey, target: null }), /目的地と到着期限/);
  assert.throws(() => serializeJourney({ ...journey, sections: [{ ...journey.sections[0], route: { ...route, duration_minutes: -1 } }] }), /必須情報/);
  assert.throws(() => serializeJourney({ ...journey, sections: [{ ...journey.sections[0], route: { ...route, segments: [{ ...route.segments[0], from: "" }] } }] }), /segment/);
  assert.throws(() => serializeJourney({ ...journey, departure_at: "2026-10-01T09:00" }), /先頭区間/);
  assert.throws(() => serializeJourney({ ...journey, target: { destination: { ...destination, place_id: "other", lat: 34 }, arrival_deadline: "2026-10-01T11:00" } }), /目的地に接続/);
});
