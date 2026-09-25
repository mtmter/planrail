import assert from "node:assert/strict";
import test from "node:test";
import { requestRouteSearch } from "./routeSearchApi.js";
import { addFixed, applyCandidates, buildPlan, createInput, initialSavedPreview, journeyForSave, searchAllGaps, searchFingerprint, selectCandidate, selectedPlace, typedPlace } from "./journeyFlow.js";

const point = (name, id, n) => ({ name, address: `${name}住所`, place_id: id, lat: 33 + n, lng: 130 + n, types: ["establishment"] });
const A = point("出発", "a", 1), B = point("乗車", "b", 2), C = point("降車", "c", 3);
const D = point("乗車2", "d", 4), E = point("降車2", "e", 5), F = point("目的地", "f", 6);
const at = (hour, minute = "00") => `2026-10-01T${hour}:${minute}`;
const route = (section, id, departure, arrival) => ({
  candidate_id: id, origin: section.origin.name, destination: section.destination.name,
  departure_at: departure, arrival_at: arrival, duration_minutes: 30, transport_mode: "TRANSIT",
  transfer_count: null, walk_minutes: null, wait_minutes: null, fare: null, segments: [],
});
function input() { return { ...createInput(), origin: selectedPlace(A), destination: selectedPlace(F), deadline: at("12") }; }
function withFixed(fixed) { return { ...fixed, origin: selectedPlace(B), destination: selectedPlace(C), departure_at: at("09"), arrival_at: at("10"), label: "列車" }; }

test("0, 1, and multiple fixed movements derive all gaps and their time constraints", () => {
  const plain = buildPlan(input());
  assert.deepEqual(plain.map((section) => section.kind), ["ROUTE"]);
  assert.deepEqual(plain[0].constraint, { type: "arrival", at: at("12") });
  let one = addFixed(input());
  one.fixed[0] = withFixed(one.fixed[0]);
  const twoGaps = buildPlan(one);
  assert.deepEqual(twoGaps.map((section) => section.kind), ["ROUTE", "FIXED", "ROUTE"]);
  assert.deepEqual(twoGaps[0].constraint, { type: "arrival", at: at("09") });
  assert.deepEqual(twoGaps[2].constraint, { type: "departure", at: at("10"), latest_arrival_at: at("12") });
  let many = addFixed(one);
  many.fixed[1] = { ...many.fixed[1], origin: selectedPlace(D), destination: selectedPlace(E), departure_at: at("11"), arrival_at: at("11", "30") };
  const threeGaps = buildPlan(many);
  assert.deepEqual(threeGaps.map((section) => section.kind), ["ROUTE", "FIXED", "ROUTE", "FIXED", "ROUTE"]);
  assert.deepEqual(threeGaps[2].constraint, { type: "departure", at: at("10"), latest_arrival_at: at("11") });
  assert.throws(() => buildPlan({ ...many, fixed: many.fixed.map((item, index) => index ? { ...item, departure_at: at("08") } : item) }), /時刻/);
  const overnight = { ...one, deadline: "2026-10-02T02:00", fixed: [{ ...one.fixed[0], departure_at: "2026-10-01T23:00", arrival_at: "2026-10-02T00:30" }] };
  assert.deepEqual(buildPlan(overnight)[2].constraint, { type: "departure", at: "2026-10-02T00:30", latest_arrival_at: "2026-10-02T02:00" });
});

test("fixed-only journey has no gaps and still validates before saving", () => {
  let model = addFixed(input());
  model.fixed[0] = { ...model.fixed[0], origin: selectedPlace(A), destination: selectedPlace(F), departure_at: at("09"), arrival_at: at("10") };
  const plan = buildPlan(model);
  assert.deepEqual(plan.map((section) => section.kind), ["FIXED"]);
  assert.equal(journeyForSave(model, plan).sections.length, 1);
  assert.throws(() => journeyForSave(model, []), /検索/);
  const sameCoordinates = { ...model, fixed: [{ ...model.fixed[0], origin: selectedPlace({ ...A, place_id: "another-origin" }), destination: selectedPlace({ ...F, place_id: "another-destination" }) }] };
  assert.deepEqual(buildPlan(sameCoordinates).map((section) => section.kind), ["FIXED"]);
  assert.equal(journeyForSave(sameCoordinates, buildPlan(sameCoordinates)).sections.length, 1);
});

test("name-only FIXED origin blocks the required incoming gap before search", () => {
  const model = addFixed(input());
  model.fixed[0] = { ...withFixed(model.fixed[0]), origin: typedPlace("博多駅") };
  assert.throws(() => buildPlan(model), /固定移動の乗車地点をPlaces候補から選択/);
});

test("name-only FIXED destination blocks the required outgoing gap before search", () => {
  const model = addFixed(input());
  model.fixed[0] = { ...withFixed(model.fixed[0]), destination: typedPlace("降車地点") };
  assert.throws(() => buildPlan(model), /固定移動の降車地点をPlaces候補から選択/);
});

test("Event-linked FIXED-only requires the final place_id to match its target", () => {
  const model = addFixed(input());
  model.fixed[0] = { ...model.fixed[0], origin: selectedPlace(A), destination: selectedPlace(F), departure_at: at("09"), arrival_at: at("10") };
  const target = { destination: F, arrival_deadline: at("12") };
  const connected = buildPlan(model, target);
  assert.deepEqual(connected.map((section) => section.kind), ["FIXED"]);
  assert.equal(journeyForSave(model, connected, target, "event-1").sections.length, 1);

  for (const place_id of ["other-place", null]) {
    const changed = { ...model, fixed: [{ ...model.fixed[0], destination: selectedPlace({ ...F, place_id }) }] };
    const plan = buildPlan(changed, target);
    assert.deepEqual(plan.map((section) => section.kind), ["FIXED", "ROUTE"]);
    assert.deepEqual(plan[1].origin, changed.fixed[0].destination.point);
    assert.deepEqual(plan[1].destination, F);
    assert.throws(() => journeyForSave(changed, plan, target, "event-1"), /検索/);
  }
});

test("selected PlacePoint fields reach each route-search request without swapping endpoints", async () => {
  let model = addFixed(input());
  model.fixed[0] = withFixed(model.fixed[0]);
  const gaps = buildPlan(model).filter((section) => section.kind === "ROUTE");
  const sent = [];
  for (const gap of gaps) {
    await requestRouteSearch("/route-search", { origin: gap.origin, destination: gap.destination, time_constraint: gap.constraint }, async (_, options) => {
      sent.push(JSON.parse(options.body));
      return { ok: true, json: async () => ({ candidates: [] }) };
    });
  }
  assert.deepEqual(sent[0].origin, A);
  assert.deepEqual(sent[0].destination, B);
  assert.deepEqual(sent[1].origin, C);
  assert.deepEqual(sent[1].destination, F);
  assert.deepEqual(Object.keys(sent[0].origin).sort(), ["address", "lat", "lng", "name", "place_id", "types"]);
});

test("recommendation, candidate change, and missing candidate stay local to a gap", () => {
  let model = addFixed(input());
  model.fixed[0] = withFixed(model.fixed[0]);
  const plan = buildPlan(model);
  const first = plan[0], last = plan[2];
  const a = route(first, "a", at("08"), at("08", "30"));
  const b = route(first, "b", at("08", "10"), at("08", "40"));
  const selected = applyCandidates(first, { candidates: [a, b], recommended_candidate_id: "b", warnings: ["注意"] });
  assert.equal(selected.route.candidate_id, "b");
  assert.equal(applyCandidates(first, { candidates: [a, b], recommended_candidate_id: "missing" }).route.candidate_id, "a");
  assert.equal(applyCandidates(first, { candidates: [route(first, "late", at("09"), at("09", "30"))] }).route, null);
  assert.equal(applyCandidates(last, { candidates: [route(last, "early", at("09"), at("09", "30"))] }).route, null);
  const chosen = selectCandidate([selected, plan[1], { ...last, route: route(last, "other", at("10", "20"), at("11")) }], first.key, "a");
  assert.equal(chosen[0].route.candidate_id, "a");
  assert.equal(chosen[2].route.candidate_id, "other");
  assert.throws(() => journeyForSave(model, [selected, plan[1], last]), /検索/);
});

test("search execution bounds parallel requests to three", async () => {
  const plan = Array.from({ length: 4 }, (_, index) => ({ ...buildPlan(input())[0], key: `route-${index}` }));
  let active = 0, peak = 0;
  await searchAllGaps(plan, async (section) => {
    active += 1; peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    return { candidates: [route(section, section.key, at("10"), at("11"))] };
  });
  assert.equal(peak, 3);
});

test("one failed gap preserves success; manual retry searches every gap without automatic retry", async () => {
  let model = addFixed(input());
  model.fixed[0] = withFixed(model.fixed[0]);
  const plan = buildPlan(model);
  const calls = [];
  let active = 0, peak = 0;
  const first = await searchAllGaps(plan, async (section) => {
    calls.push(section.key);
    active += 1; peak = Math.max(peak, active);
    await Promise.resolve();
    active -= 1;
    if (section.key === plan[2].key) throw new Error("経路なし");
    return { candidates: [route(section, "ok", at("08"), at("08", "30"))], recommended_candidate_id: "ok" };
  });
  assert.deepEqual(calls, [plan[0].key, plan[2].key]);
  assert.equal(peak, 2);
  assert.ok(first[0].route);
  assert.equal(first[2].error, "経路なし");
  assert.throws(() => journeyForSave(model, first), /検索/);
  const retried = await searchAllGaps(plan, async (section) => {
    calls.push(section.key);
    return { candidates: [route(section, section.key, section.key === plan[0].key ? at("08") : at("10", "20"), section.key === plan[0].key ? at("08", "30") : at("11"))] };
  });
  assert.deepEqual(calls.slice(2), [plan[0].key, plan[2].key]);
  assert.ok(journeyForSave(model, retried).sections[2].route);
});

test("search fingerprint ignores fixed label and detects route-affecting edits", () => {
  let model = addFixed(input());
  model.fixed[0] = withFixed(model.fixed[0]);
  const original = searchFingerprint(model);
  assert.equal(searchFingerprint({ ...model, fixed: [{ ...model.fixed[0], label: "新名称" }] }), original);
  assert.notEqual(searchFingerprint({ ...model, origin: selectedPlace(D) }), original);
  assert.notEqual(searchFingerprint({ ...model, deadline: at("13") }), original);
  assert.notEqual(searchFingerprint({ ...model, fixed: [{ ...model.fixed[0], arrival_at: at("10", "10") }] }), original);
  assert.notEqual(searchFingerprint(addFixed(model)), original);
  assert.notEqual(searchFingerprint({ ...model, fixed: [] }), original);
});

test("saved preview has selected route but no candidate cache and current Event target can invalidate it", () => {
  const model = input();
  const plan = buildPlan(model);
  const candidate = route(plan[0], "stored", at("10"), at("11"));
  const saved = journeyForSave(model, [{ ...plan[0], route: candidate }]);
  const restored = createInput({ id: "standalone-1", ...saved });
  const preview = initialSavedPreview(saved, restored);
  assert.equal(preview[0].route.candidate_id, undefined);
  assert.deepEqual(preview[0].candidates, []);
  assert.equal(initialSavedPreview(saved, restored, { destination: E, arrival_deadline: at("12") }), null);
  assert.equal(initialSavedPreview(saved, restored, { destination: { ...F, place_id: "new-place" }, arrival_deadline: at("12") }), null);
  assert.equal(initialSavedPreview(saved, restored, { destination: F, arrival_deadline: at("11", "30") }), null);
});
