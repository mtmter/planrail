import { toDateTimeInputValue } from "./dateUtils.js";

function sectionDepartureAt(section) {
  return section?.kind === "ROUTE" ? section.route?.departure_at : section?.departure_at;
}

function sectionArrivalAt(section) {
  return section?.kind === "ROUTE" ? section.route?.arrival_at : section?.arrival_at;
}

function containsTime(start, end, now) {
  return typeof start === "string" && typeof end === "string" && start <= now && now < end;
}

export function getCurrentJourneyPart(sections, currentTime) {
  if (!Array.isArray(sections) || !(currentTime instanceof Date) || Number.isNaN(currentTime.getTime())) return null;
  const now = toDateTimeInputValue(currentTime);

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const previousArrival = sectionArrivalAt(sections[sectionIndex - 1]);
    if (containsTime(previousArrival, sectionDepartureAt(section), now)) {
      return { kind: "wait", sectionIndex };
    }
    if (section?.kind === "FIXED" && containsTime(section.departure_at, section.arrival_at, now)) {
      return { kind: "fixed", sectionIndex };
    }
    if (section?.kind === "ROUTE") {
      const segments = Array.isArray(section.route?.segments)
        ? section.route.segments.filter((segment) => segment && typeof segment === "object")
        : [];
      for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
        const segment = segments[segmentIndex];
        if (containsTime(segment?.departure_at, segment?.arrival_at, now)) {
          return { kind: "segment", sectionIndex, segmentIndex };
        }
      }
    }
  }
  return null;
}
