import assert from "node:assert/strict";
import test from "node:test";
import {
  appendFixed, changeFirstOrigin, changeFixedField, changeFixedPlace,
  changeTargetDeadline, changeTargetPlace, createJourneyDraft, editPlaceInput,
  getRouteContext, getSaveState, removeFixed, removeRoute, selectPlaceInput,
  setRouteCandidates,
} from "./journeyDraft.js";

const point = (name, id, lat) => ({ name, place_id: id, lat, lng: 130 + lat, types: [] });
const home = point("自宅", "home", 1);
const station = point("駅", "station", 2);
const terminal = point("終点", "terminal", 3);
const venue = point("会場", "venue", 4);
const candidate = (origin, destination, departure_at, arrival_at, id = "r1") => ({
  candidate_id: id, origin: origin.name, destination: destination.name,
  departure_at, arrival_at, duration_minutes: 30, transport_mode: "transit",
  transfer_count: null, walk_minutes: null, wait_minutes: null, fare: null,
  segments: [{ type: "TRANSIT", from: origin.name, to: destination.name,
    departure_at, arrival_at, duration_minutes: 30, line_name: null }],
});
const result = (route) => ({ candidates: [route], recommended_candidate_id: route.candidate_id, warnings: [] });
const selected = (draft, routeId, route, target = null) =>
  setRouteCandidates(draft, routeId, result(route), getRouteContext(draft, routeId, target));

function base() {
  let draft = createJourneyDraft();
  draft = changeFirstOrigin(draft, selectPlaceInput(home));
  draft = changeTargetPlace(draft, selectPlaceInput(venue));
  return changeTargetDeadline(draft, "2026-10-01T12:00");
}

test("Standalone Places input keeps text and invalidates only its selected point on edit", () => {
  const input = selectPlaceInput(venue);
  assert.deepEqual(editPlaceInput(input, "会場東"), { text: "会場東", point: null });
  assert.deepEqual(editPlaceInput(input, "会場"), input);
  const draft = changeTargetPlace(createJourneyDraft(), editPlaceInput({ text: "", point: null }, "会"));
  assert.equal(draft.targetPlace.text, "会");
  assert.equal(draft.targetPlace.point, null);
});

test("FIXED name-only inputs and fixed-only Standalone save work", () => {
  let draft = appendFixed(createJourneyDraft());
  draft = removeRoute(draft, 1);
  draft = removeRoute(draft, 3);
  const fixed = draft.sections[0];
  draft = changeFixedPlace(draft, fixed.id, "origin", { text: "博多", point: null });
  draft = changeFixedPlace(draft, fixed.id, "destination", { text: "新大阪", point: null });
  draft = changeFixedField(draft, fixed.id, "departure_at", "2026-10-01T08:00");
  draft = changeFixedField(draft, fixed.id, "arrival_at", "2026-10-01T10:00");
  const save = getSaveState(draft);
  assert.equal(save.canSave, true);
  assert.equal(save.journey.target, null);
  assert.equal(save.journey.sections[0].origin.place_id, null);
  let withRoute = appendFixed(base());
  withRoute = changeFixedPlace(withRoute, 2, "origin", { text: "駅（名前のみ）", point: null });
  withRoute = changeFixedField(withRoute, 2, "departure_at", "2026-10-01T09:00");
  assert.equal(getRouteContext(withRoute, 1).ready, false);
});

test("confirmed ROUTE clears after origin or deadline changes", () => {
  const route = candidate(home, venue, "2026-10-01T10:00", "2026-10-01T10:30");
  let draft = selected(base(), 1, route);
  assert.equal(getSaveState(draft).canSave, true);
  draft = changeFirstOrigin(draft, selectPlaceInput(station));
  assert.equal(draft.sections[0].route, null);
  assert.deepEqual(draft.sections[0].candidates, []);
  draft = selected(base(), 1, route);
  draft = changeTargetDeadline(draft, "2026-10-01T11:00");
  assert.equal(draft.sections[0].route, null);
  assert.equal(getSaveState(draft).canSave, false);
  draft = selected(base(), 1, route);
  draft = changeTargetPlace(draft, selectPlaceInput(terminal));
  assert.equal(draft.sections[0].route, null);
});

test("adding FIXED after a confirmed ROUTE creates editable ROUTE/FIXED/ROUTE", () => {
  const route = candidate(home, venue, "2026-10-01T10:00", "2026-10-01T10:30");
  const draft = appendFixed(selected(base(), 1, route));
  assert.deepEqual(draft.sections.map((section) => section.kind), ["ROUTE", "FIXED", "ROUTE"]);
  assert.equal(draft.sections[0].route, null);
  assert.equal(draft.sections[2].route, null);
});

test("FIXED changes invalidate only the adjacent ROUTE; label keeps both", () => {
  let draft = appendFixed(appendFixed(base()));
  const [first, fixedA, middle, fixedB, last] = draft.sections;
  draft = changeFixedPlace(draft, fixedA.id, "origin", selectPlaceInput(station));
  draft = changeFixedPlace(draft, fixedA.id, "destination", selectPlaceInput(terminal));
  draft = changeFixedField(draft, fixedA.id, "departure_at", "2026-10-01T09:00");
  draft = changeFixedField(draft, fixedA.id, "arrival_at", "2026-10-01T09:30");
  draft = changeFixedPlace(draft, fixedB.id, "origin", selectPlaceInput(station));
  draft = changeFixedPlace(draft, fixedB.id, "destination", selectPlaceInput(terminal));
  draft = changeFixedField(draft, fixedB.id, "departure_at", "2026-10-01T10:30");
  draft = changeFixedField(draft, fixedB.id, "arrival_at", "2026-10-01T11:00");
  draft = selected(draft, first.id, candidate(home, station, "2026-10-01T08:00", "2026-10-01T08:30"));
  draft = selected(draft, middle.id, candidate(terminal, station, "2026-10-01T09:40", "2026-10-01T10:10"));
  draft = selected(draft, last.id, candidate(terminal, venue, "2026-10-01T11:10", "2026-10-01T11:40"));
  assert.equal(getSaveState(draft).canSave, true);
  draft = changeFixedField(draft, fixedA.id, "label", "列車");
  assert.ok(draft.sections[0].route && draft.sections[2].route && draft.sections[4].route);
  draft = changeFixedField(draft, fixedA.id, "arrival_at", "2026-10-01T09:35");
  assert.ok(draft.sections[0].route);
  assert.equal(draft.sections[2].route, null);
  assert.ok(draft.sections[4].route);
  draft = changeFixedPlace(draft, fixedB.id, "origin", selectPlaceInput(venue));
  assert.ok(draft.sections[0].route);
  assert.equal(draft.sections[2].route, null);
  assert.ok(draft.sections[4].route);
  assert.equal(getSaveState(draft).canSave, false);
  draft = removeFixed(draft, fixedA.id);
  assert.deepEqual(draft.sections.map((section) => section.kind), ["ROUTE", "FIXED", "ROUTE"]);
});

test("ROUTE search between fixed sections uses both time bounds", () => {
  let draft = appendFixed(appendFixed(base()));
  const [, firstFixed, between, secondFixed] = draft.sections;
  draft = changeFixedPlace(draft, firstFixed.id, "destination", selectPlaceInput(terminal));
  draft = changeFixedField(draft, firstFixed.id, "arrival_at", "2026-10-01T09:00");
  draft = changeFixedPlace(draft, secondFixed.id, "origin", selectPlaceInput(station));
  draft = changeFixedField(draft, secondFixed.id, "departure_at", "2026-10-01T10:00");
  const context = getRouteContext(draft, between.id);
  assert.equal(context.ready, true);
  assert.deepEqual(context.constraint, { type: "departure", at: "2026-10-01T09:00", latest_arrival_at: "2026-10-01T10:00" });
  const late = candidate(terminal, station, "2026-10-01T09:30", "2026-10-01T10:10", "late");
  draft = setRouteCandidates(draft, between.id, result(late), context);
  assert.equal(draft.sections[2].route, null);
});

test("Event-linked target connection and FIXED-only place_id condition gate save", () => {
  const target = { destination: venue, arrival_deadline: "2026-10-01T12:00" };
  let draft = appendFixed(createJourneyDraft());
  draft = removeRoute(removeRoute(draft, 1), 3);
  const fixed = draft.sections[0];
  draft = changeFixedPlace(draft, fixed.id, "origin", { text: "博多", point: null });
  draft = changeFixedPlace(draft, fixed.id, "destination", { text: "会場", point: null });
  draft = changeFixedField(draft, fixed.id, "departure_at", "2026-10-01T10:00");
  draft = changeFixedField(draft, fixed.id, "arrival_at", "2026-10-01T11:00");
  assert.equal(getSaveState(draft, target, "event-1").canSave, false);
  draft = changeFixedPlace(draft, fixed.id, "destination", selectPlaceInput(venue));
  assert.equal(getSaveState(draft, target, "event-1").canSave, true);
  draft = changeFixedField(draft, fixed.id, "arrival_at", "2026-10-01T12:30");
  assert.equal(getSaveState(draft, target, "event-1").canSave, false);
  const routeDraft = selected(base(), 1, candidate(home, venue, "2026-10-01T10:00", "2026-10-01T10:30"));
  assert.equal(getSaveState(routeDraft, { destination: terminal, arrival_deadline: "2026-10-01T12:00" }, "event-1").canSave, false);
});
