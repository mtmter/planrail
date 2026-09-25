import { isJourneyDateTime, serializeJourney } from "./journeySerializer.js";

export const emptyPlaceInput = () => ({ text: "", point: null });
export const editPlaceInput = (input, text) => ({ text, point: input.point?.name === text ? input.point : null });
export const selectPlaceInput = (point) => ({ text: point?.name || "", point: point || null });

const routeSection = (id) => ({ id, kind: "ROUTE", route: null, candidates: [], recommendedId: null, warnings: [], searchContext: null });
const fixedSection = (id) => ({ id, kind: "FIXED", origin: emptyPlaceInput(), destination: emptyPlaceInput(), departure_at: "", arrival_at: "", label: "" });
const clearRoute = (section) => section?.kind === "ROUTE" ? { ...section, route: null, candidates: [], recommendedId: null, warnings: [], searchContext: null } : section;

export function createJourneyDraft() {
  return { firstOrigin: emptyPlaceInput(), targetPlace: emptyPlaceInput(), deadline: "", sections: [routeSection(1)], nextId: 2 };
}

function updateSections(draft, updater) {
  return { ...draft, sections: updater(draft.sections) };
}

export function changeFirstOrigin(draft, input) {
  return { ...updateSections(draft, (sections) => sections.map((section, index) => index === 0 ? clearRoute(section) : section)), firstOrigin: input };
}

export function changeTargetPlace(draft, input) {
  return { ...updateSections(draft, (sections) => sections.map((section, index) => index === sections.length - 1 ? clearRoute(section) : section)), targetPlace: input };
}

export function changeTargetDeadline(draft, deadline) {
  return { ...updateSections(draft, (sections) => sections.map((section, index) => index === sections.length - 1 ? clearRoute(section) : section)), deadline };
}

export function changeFixedPlace(draft, id, field, input) {
  return updateSections(draft, (sections) => {
    const index = sections.findIndex((section) => section.id === id && section.kind === "FIXED");
    if (index < 0 || !["origin", "destination"].includes(field)) return sections;
    return sections.map((section, at) => at === index ? { ...section, [field]: input } :
      at === index + (field === "origin" ? -1 : 1) ? clearRoute(section) : section);
  });
}

export function changeFixedField(draft, id, field, value) {
  if (!["departure_at", "arrival_at", "label"].includes(field)) return draft;
  return updateSections(draft, (sections) => {
    const index = sections.findIndex((section) => section.id === id && section.kind === "FIXED");
    if (index < 0) return sections;
    return sections.map((section, at) => at === index ? { ...section, [field]: value } :
      field !== "label" && at === index + (field === "departure_at" ? -1 : 1) ? clearRoute(section) : section);
  });
}

export function addFixedAtRoute(draft, routeId) {
  const index = draft.sections.findIndex((section) => section.id === routeId && section.kind === "ROUTE");
  if (index < 0) return draft;
  const sections = [...draft.sections];
  sections.splice(index, 1, clearRoute(sections[index]), fixedSection(draft.nextId), routeSection(draft.nextId + 1));
  return { ...draft, sections, nextId: draft.nextId + 2 };
}

export function appendFixed(draft) {
  const last = draft.sections[draft.sections.length - 1];
  if (last?.kind === "ROUTE") return addFixedAtRoute(draft, last.id);
  return {
    ...draft,
    sections: [...draft.sections, fixedSection(draft.nextId)],
    nextId: draft.nextId + 1,
  };
}

export function removeRoute(draft, routeId) {
  if (!draft.sections.some((section) => section.kind === "FIXED")) return draft;
  return updateSections(draft, (sections) => sections.filter((section) => section.id !== routeId || section.kind !== "ROUTE"));
}

export function removeFixed(draft, fixedId) {
  const index = draft.sections.findIndex((section) => section.id === fixedId && section.kind === "FIXED");
  if (index < 0) return draft;
  const sections = draft.sections.filter((section) => section.id !== fixedId);
  const left = sections[index - 1];
  const right = sections[index];
  if (left?.kind === "ROUTE" && right?.kind === "ROUTE") {
    sections.splice(index, 1);
    sections[index - 1] = clearRoute(left);
  } else {
    if (left?.kind === "ROUTE") sections[index - 1] = clearRoute(left);
    if (right?.kind === "ROUTE") sections[index] = clearRoute(right);
  }
  if (!sections.length) sections.push(routeSection(draft.nextId));
  return { ...draft, sections, nextId: sections.length === 1 && sections[0].id === draft.nextId ? draft.nextId + 1 : draft.nextId };
}

export function clearRouteSelection(draft, routeId) {
  return updateSections(draft, (sections) => sections.map((section) => section.id === routeId ? clearRoute(section) : section));
}

export function setRouteCandidates(draft, routeId, result, context) {
  const candidates = (result.candidates || []).filter((candidate) =>
    isJourneyDateTime(candidate.departure_at) && isJourneyDateTime(candidate.arrival_at) &&
    candidate.arrival_at >= candidate.departure_at &&
    (!context.earliestDeparture || candidate.departure_at >= context.earliestDeparture) &&
    (!context.latestArrival || candidate.arrival_at <= context.latestArrival)).slice(0, 3);
  const recommended = candidates.find((candidate) => candidate.candidate_id === result.recommended_candidate_id) || candidates[0] || null;
  return updateSections(draft, (sections) => sections.map((section) => section.id === routeId ? {
    ...section, candidates, recommendedId: result.recommended_candidate_id, warnings: result.warnings || [], route: recommended,
    searchContext: { origin: context.origin, destination: context.destination, constraint: context.constraint },
  } : section));
}

export function selectRouteCandidate(draft, routeId, candidateId) {
  return updateSections(draft, (sections) => sections.map((section) => section.id === routeId ? {
    ...section, route: section.candidates.find((candidate) => candidate.candidate_id === candidateId) || section.route,
  } : section));
}

export function getDraftTarget(draft, eventTarget = null) {
  if (eventTarget) return eventTarget;
  return draft.targetPlace.point && draft.deadline ? { destination: draft.targetPlace.point, arrival_deadline: draft.deadline } : null;
}

export function getRouteContext(draft, routeId, eventTarget = null) {
  const index = draft.sections.findIndex((section) => section.id === routeId && section.kind === "ROUTE");
  if (index < 0) return null;
  const previous = draft.sections[index - 1];
  const next = draft.sections[index + 1];
  const target = getDraftTarget(draft, eventTarget);
  const origin = previous?.kind === "FIXED" ? previous.destination.point : draft.firstOrigin.point;
  const destination = next?.kind === "FIXED" ? next.origin.point : target?.destination;
  const earliestDeparture = previous?.kind === "FIXED" ? previous.arrival_at : null;
  const latestArrival = next?.kind === "FIXED" ? next.departure_at : target?.arrival_deadline;
  const constraint = earliestDeparture ? { type: "departure", at: earliestDeparture, latest_arrival_at: latestArrival } :
    { type: "arrival", at: latestArrival };
  const ready = origin && destination && [origin.lat, origin.lng, destination.lat, destination.lng].every(Number.isFinite) &&
    isJourneyDateTime(constraint.at) && isJourneyDateTime(latestArrival) &&
    (!earliestDeparture || earliestDeparture <= latestArrival);
  return { origin, destination, earliestDeparture, latestArrival, constraint, ready: Boolean(ready) };
}

function placeFromInput(input) {
  return input.point || { name: input.text.trim() };
}

export function getSaveState(draft, eventTarget = null, eventId = null) {
  try {
    if (!draft.sections.length) throw new Error("移動区間を追加してください");
    const hasRoute = draft.sections.some((section) => section.kind === "ROUTE");
    const target = hasRoute || eventId || draft.targetPlace.text || draft.deadline
      ? getDraftTarget(draft, eventTarget) : null;
    if ((hasRoute || eventId || draft.targetPlace.text || draft.deadline) && !target) {
      throw new Error("目的地と到着希望日時を確定してください");
    }
    const sections = draft.sections.map((section) => {
      if (section.kind === "FIXED") return {
        kind: "FIXED", origin: placeFromInput(section.origin), destination: placeFromInput(section.destination),
        departure_at: section.departure_at, arrival_at: section.arrival_at, label: section.label,
      };
      const context = getRouteContext(draft, section.id, eventTarget);
      if (!section.route || !context?.ready || !section.searchContext ||
          JSON.stringify(section.searchContext) !== JSON.stringify({ origin: context.origin, destination: context.destination, constraint: context.constraint })) {
        throw new Error("ROUTEの地点・日時を設定して経路を確定してください");
      }
      return { kind: "ROUTE", origin: context.origin, destination: context.destination, route: section.route };
    });
    const first = sections[0];
    const last = sections[sections.length - 1];
    const journey = serializeJourney({
      event_id: eventId, target,
      departure_at: first.kind === "ROUTE" ? first.route.departure_at : first.departure_at,
      arrival_at: last.kind === "ROUTE" ? last.route.arrival_at : last.arrival_at,
      sections,
    });
    return { canSave: true, journey, reason: "" };
  } catch (error) {
    return { canSave: false, journey: null, reason: error.message };
  }
}
