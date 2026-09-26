import {
  addDays,
  eventOccursOnDate,
  parseDateTime,
  toDateTimeInputValue,
} from "./dateUtils.js";

export function getMobileDateStripDates(selectedDate) {
  return Array.from({ length: 61 }, (_, index) => addDays(selectedDate, index - 30));
}

export function getMobileCalendarDay(items, date) {
  const dayItems = items
    .filter((item) => eventOccursOnDate(item, date))
    .sort((first, second) =>
      (first.start_at ?? "").localeCompare(second.start_at ?? ""),
    );

  return {
    items: dayItems,
    hasEvent: dayItems.some((item) => item.itemType !== "journey"),
    hasJourney: dayItems.some((item) => item.itemType === "journey"),
    hiddenCount: Math.max(0, dayItems.length - 1),
  };
}

export function getUpcomingPreparationGroups(
  events,
  preparations,
  reminderMinutes,
  currentTime,
) {
  if (preparations === null) {
    return null;
  }

  const itemsByEvent = new Map();
  preparations.forEach((preparation) => {
    if (preparation.completed !== false) {
      return;
    }
    const eventId = String(preparation.event_id);
    const eventItems = itemsByEvent.get(eventId) ?? [];
    eventItems.push(preparation);
    itemsByEvent.set(eventId, eventItems);
  });

  return events
    .map((event) => {
      const eventStart =
        typeof event.start_at === "string"
          ? parseDateTime(event.start_at)
          : null;
      const validStart =
        typeof event.start_at === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(event.start_at) &&
        eventStart &&
        !Number.isNaN(eventStart.getTime()) &&
        toDateTimeInputValue(eventStart) === event.start_at;
      const remainingMilliseconds = validStart
        ? eventStart.getTime() - currentTime.getTime()
        : 0;

      return {
        event,
        eventStart,
        items: itemsByEvent.get(String(event.id)) ?? [],
        remainingMilliseconds,
        isSoon:
          remainingMilliseconds > 0 &&
          remainingMilliseconds <= reminderMinutes * 60 * 1000,
      };
    })
    .filter((group) => group.remainingMilliseconds > 0 && group.items.length > 0)
    .sort(
      (first, second) =>
        first.eventStart - second.eventStart ||
        String(first.event.id).localeCompare(String(second.event.id)),
    );
}
