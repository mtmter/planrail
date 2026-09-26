import { eventOccursOnDate, getDateKey, isSameDay, parseDateTime, toDateTimeInputValue } from "./dateUtils.js";

export function timelineItems(events, journeys, selectedDate) {
  const dayStart = `${getDateKey(selectedDate)}T00:00`;
  return [
    ...events.map((event) => ({ ...event, itemType: "event" })),
    ...journeys.map((journey) => ({
      ...journey,
      itemType: "journey",
      start_at: journey.departure_at,
      end_at: journey.arrival_at,
    })),
  ].filter((item) => eventOccursOnDate(item, selectedDate))
    .sort((first, second) =>
      (first.start_at < dayStart ? dayStart : first.start_at).localeCompare(second.start_at < dayStart ? dayStart : second.start_at) ||
      first.start_at.localeCompare(second.start_at) ||
      first.itemType.localeCompare(second.itemType) ||
      String(first.id).localeCompare(String(second.id)));
}

export function focusedJourney(items, selectedDate, currentTime) {
  if (!isSameDay(selectedDate, currentTime)) return null;
  const now = toDateTimeInputValue(currentTime);
  const candidates = items.filter((item) => item.itemType === "journey");
  const active = candidates.filter((item) => item.departure_at <= now && now < item.arrival_at)
    .sort((first, second) => first.arrival_at.localeCompare(second.arrival_at) ||
      first.departure_at.localeCompare(second.departure_at) ||
      String(first.id).localeCompare(String(second.id)));
  if (active.length) return { journey: active[0], status: "active" };
  const next = candidates.filter((item) => item.departure_at > now)
    .sort((first, second) => first.departure_at.localeCompare(second.departure_at) ||
      String(first.id).localeCompare(String(second.id)));
  return next.length ? { journey: next[0], status: "next" } : null;
}

export function timelineJourneyName(journey, event) {
  if (journey.event_id && event) return `${event.title}へ`;
  const sections = Array.isArray(journey.sections) ? journey.sections : [];
  const destination = journey.target?.destination?.name || sections[sections.length - 1]?.destination?.name;
  return `${destination || "目的地"}へ移動`;
}

export function formatRelativeTime(value, selectedDate) {
  const date = parseDateTime(value);
  if (!date) return "";
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const selectedDay = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
  const difference = Math.round((day - selectedDay) / 86400000);
  const prefix = difference === -1 ? "前日 " : difference === 1 ? "翌日 " :
    difference < -1 ? `${Math.abs(difference)}日前 ` : difference > 1 ? `${difference}日後 ` : "";
  return `${prefix}${value.slice(11, 16)}`;
}
