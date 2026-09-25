import { isJourneyDateTime, serializeJourney, serializePlacePoint } from "./journeySerializer.js";

export const emptyPlace = () => ({ text: "", point: null });
export const selectedPlace = (point) => ({ text: point?.name || "", point: point || null });
export const typedPlace = (text) => ({ text, point: null });

export function createInput(journey = null) {
  if (!journey) return { origin: emptyPlace(), destination: emptyPlace(), deadline: "", fixed: [], nextId: 1 };
  const first = journey.sections?.[0];
  const fixed = (journey.sections || []).filter((section) => section.kind === "FIXED").map((section, index) => ({
    id: index + 1, origin: selectedPlace(section.origin), destination: selectedPlace(section.destination),
    departure_at: section.departure_at, arrival_at: section.arrival_at, label: section.label || "",
  }));
  return {
    origin: first ? selectedPlace(first.origin) : emptyPlace(),
    destination: selectedPlace(journey.target?.destination),
    deadline: journey.target?.arrival_deadline || "",
    fixed,
    nextId: fixed.length + 1,
  };
}

export function addFixed(input) {
  return { ...input, fixed: [...input.fixed, { id: input.nextId, origin: emptyPlace(), destination: emptyPlace(), departure_at: "", arrival_at: "", label: "" }], nextId: input.nextId + 1 };
}

export function sortedFixed(input) {
  return input.fixed.map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.departure_at.localeCompare(b.item.departure_at) || a.index - b.index)
    .map(({ item }) => item);
}

function validPoint(point) {
  return point && point.name?.trim() && Number.isFinite(point.lat) && Number.isFinite(point.lng);
}

export function samePlace(a, b) {
  if (a?.place_id && b?.place_id && a.place_id === b.place_id) return true;
  return [a?.lat, a?.lng, b?.lat, b?.lng].every(Number.isFinite) && a.lat === b.lat && a.lng === b.lng;
}

function pointFingerprint(input) {
  return input.point ? serializePlacePoint(input.point) : { text: input.text.trim() };
}

export function searchFingerprint(input, target) {
  return JSON.stringify({
    origin: pointFingerprint(input.origin),
    destination: target ? serializePlacePoint(target.destination) : pointFingerprint(input.destination),
    deadline: target?.arrival_deadline || input.deadline,
    fixed: sortedFixed(input).map((item) => ({ id: item.id, origin: pointFingerprint(item.origin), destination: pointFingerprint(item.destination), departure_at: item.departure_at, arrival_at: item.arrival_at })),
  });
}

export function buildPlan(input, target = null) {
  const destination = target?.destination || input.destination.point;
  const deadline = target?.arrival_deadline || input.deadline;
  if (!validPoint(input.origin.point)) throw new Error("出発地をPlaces候補から選択してください");
  if (!validPoint(destination)) throw new Error("目的地をPlaces候補から選択してください");
  if (!isJourneyDateTime(deadline)) throw new Error("到着したい日時を入力してください");
  const fixed = sortedFixed(input);
  const sections = [];
  let from = input.origin.point;
  let lower = null;
  for (const item of [...fixed, null]) {
    const to = item?.origin.point || destination;
    const upper = item?.departure_at || deadline;
    if (item) {
      if (!item.origin.text.trim() || !item.destination.text.trim()) throw new Error("固定移動の乗降地点を入力してください");
      if (!isJourneyDateTime(item.departure_at) || !isJourneyDateTime(item.arrival_at) || item.arrival_at < item.departure_at) throw new Error("固定移動の発着日時を確認してください");
    }
    if (lower && lower > upper) throw new Error("固定移動の時刻が前後しています");
    if (!samePlace(from, to)) {
      if (!validPoint(from) || !validPoint(to)) throw new Error("公共交通で移動する地点をPlaces候補から選択してください");
      sections.push({ kind: "ROUTE", key: `route-${sections.length}`, origin: from, destination: to,
        earliestDeparture: lower, latestArrival: upper,
        constraint: lower ? { type: "departure", at: lower, latest_arrival_at: upper } : { type: "arrival", at: upper },
        candidates: [], route: null, warnings: [], error: "" });
    }
    if (!item) break;
    sections.push({ kind: "FIXED", key: `fixed-${item.id}`, origin: item.origin.point || { name: item.origin.text.trim() },
      destination: item.destination.point || { name: item.destination.text.trim() }, departure_at: item.departure_at,
      arrival_at: item.arrival_at, label: item.label });
    from = item.destination.point || { name: item.destination.text.trim() };
    lower = item.arrival_at;
  }
  if (!sections.length) throw new Error("出発地と目的地が同じため、移動予定を作成できません");
  return sections;
}

export function applyCandidates(section, response) {
  const candidates = (response.candidates || []).filter((candidate) =>
    isJourneyDateTime(candidate.departure_at) && isJourneyDateTime(candidate.arrival_at) &&
    candidate.departure_at <= candidate.arrival_at &&
    (!section.earliestDeparture || candidate.departure_at >= section.earliestDeparture) &&
    candidate.arrival_at <= section.latestArrival).slice(0, 3);
  if (!candidates.length) return { ...section, error: "指定時刻内の候補がありません", warnings: response.warnings || [] };
  const route = candidates.find((candidate) => candidate.candidate_id === response.recommended_candidate_id) || candidates[0];
  return { ...section, candidates, route, recommendedId: response.recommended_candidate_id, warnings: response.warnings || [], error: "" };
}

export function selectCandidate(sections, key, candidateId) {
  return sections.map((section) => section.key === key
    ? { ...section, route: section.candidates.find((candidate) => candidate.candidate_id === candidateId) || section.route }
    : section);
}

export async function searchAllGaps(plan, request, onProgress = () => {}, isCurrent = () => true) {
  const gaps = plan.map((section, index) => ({ section, index })).filter(({ section }) => section.kind === "ROUTE");
  const next = [...plan];
  let cursor = 0;
  let complete = 0;
  async function worker() {
    while (cursor < gaps.length && isCurrent()) {
      const { section, index } = gaps[cursor++];
      try { next[index] = applyCandidates(section, await request(section)); }
      catch (error) { next[index] = { ...section, error: error.message }; }
      if (!isCurrent()) return;
      onProgress(++complete, gaps.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, gaps.length) }, () => worker()));
  return next;
}

export function journeyForSave(input, sections, target = null, eventId = null) {
  if (!sections?.length || sections.some((section) => section.kind === "ROUTE" && (!section.route || section.error))) {
    throw new Error("すべての移動区間の検索を完了してください");
  }
  const fixedById = new Map(input.fixed.map((item) => [item.id, item]));
  const savedSections = sections.map((section) => {
    if (section.kind === "ROUTE") return { kind: "ROUTE", origin: section.origin, destination: section.destination, route: section.route };
    const live = fixedById.get(Number(section.key?.split("-")[1]));
    return { kind: "FIXED", origin: section.origin, destination: section.destination, departure_at: section.departure_at, arrival_at: section.arrival_at, label: live?.label ?? section.label };
  });
  const first = savedSections[0];
  const last = savedSections[savedSections.length - 1];
  return serializeJourney({
    event_id: eventId, target: target || { destination: input.destination.point, arrival_deadline: input.deadline },
    departure_at: first.kind === "ROUTE" ? first.route.departure_at : first.departure_at,
    arrival_at: last.kind === "ROUTE" ? last.route.arrival_at : last.arrival_at,
    sections: savedSections,
  });
}

export function initialSavedPreview(journey, input, target = null) {
  if (!journey?.sections?.length || !journey.target || !input.origin.point ||
      (target && (target.destination.place_id || journey.target.destination.place_id) && target.destination.place_id !== journey.target.destination.place_id) ||
      !samePlace(input.origin.point, journey.sections[0].origin) ||
      !samePlace(target?.destination || input.destination.point, journey.target.destination) ||
      (target?.arrival_deadline || input.deadline) !== journey.target.arrival_deadline) return null;
  try {
    serializeJourney(journey);
    const planned = buildPlan(input, target);
    if (planned.length !== journey.sections.length || planned.some((section, index) => section.kind !== journey.sections[index].kind ||
      !samePlace(section.origin, journey.sections[index].origin) || !samePlace(section.destination, journey.sections[index].destination) ||
      (section.kind === "FIXED" && (section.departure_at !== journey.sections[index].departure_at || section.arrival_at !== journey.sections[index].arrival_at)))) return null;
    if (planned.some((section, index) => section.kind === "ROUTE" && (
      journey.sections[index].route.departure_at < (section.earliestDeparture || "") ||
      journey.sections[index].route.arrival_at > section.latestArrival))) return null;
    return planned.map((section, index) => section.kind === "ROUTE" ? { ...section, route: journey.sections[index].route } : section);
  } catch { return null; }
}
