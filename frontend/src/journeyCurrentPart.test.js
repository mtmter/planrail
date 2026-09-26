import assert from "node:assert/strict";
import test from "node:test";
import { getCurrentJourneyPart } from "./journeyCurrentPart.js";

const sections = [
  {
    kind: "ROUTE",
    route: {
      departure_at: "2026-09-26T09:00",
      arrival_at: "2026-09-26T09:30",
      segments: [
        { type: "WALK", departure_at: "2026-09-26T09:00", arrival_at: "2026-09-26T09:10" },
        { type: "TRANSIT", departure_at: "2026-09-26T09:10", arrival_at: "2026-09-26T09:30" },
      ],
    },
  },
  { kind: "FIXED", departure_at: "2026-09-26T09:40", arrival_at: "2026-09-26T10:00" },
];

const at = (hour, minute) => new Date(2026, 8, 26, hour, minute);

test("current Journey part follows half-open segment, wait and fixed intervals", () => {
  assert.equal(getCurrentJourneyPart(sections, at(8, 59)), null);
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 0)), { kind: "segment", sectionIndex: 0, segmentIndex: 0 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 9)), { kind: "segment", sectionIndex: 0, segmentIndex: 0 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 10)), { kind: "segment", sectionIndex: 0, segmentIndex: 1 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 29)), { kind: "segment", sectionIndex: 0, segmentIndex: 1 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 30)), { kind: "wait", sectionIndex: 1 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 39)), { kind: "wait", sectionIndex: 1 });
  assert.deepEqual(getCurrentJourneyPart(sections, at(9, 40)), { kind: "fixed", sectionIndex: 1 });
  assert.equal(getCurrentJourneyPart(sections, at(10, 0)), null);
});

test("overlapping saved intervals still select one part in journey order", () => {
  const overlapping = [{ kind: "FIXED", departure_at: "2026-09-26T09:00", arrival_at: "2026-09-26T09:30" },
    { kind: "FIXED", departure_at: "2026-09-26T09:20", arrival_at: "2026-09-26T09:40" }];
  assert.deepEqual(getCurrentJourneyPart(overlapping, at(9, 25)), { kind: "fixed", sectionIndex: 0 });
  assert.equal(getCurrentJourneyPart(overlapping, null), null);
});
