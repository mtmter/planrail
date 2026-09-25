export const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

export function parseDateTime(value) {
  if (!value) {
    return null;
  }

  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hour, minute);
}

export function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeInputValue(date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${getDateKey(date)}T${hour}:${minute}`;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, numberOfDays) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + numberOfDays);
  return nextDate;
}

export function addMonths(date, numberOfMonths) {
  return new Date(date.getFullYear(), date.getMonth() + numberOfMonths, 1);
}

export function getMonthDates(selectedDate) {
  const firstDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1,
  );
  const lastDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0,
  );
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const daysNeeded = firstDay.getDay() + lastDay.getDate();
  const cellCount = daysNeeded <= 35 ? 35 : 42;

  return Array.from({ length: cellCount }, (_, index) =>
    addDays(gridStart, index),
  );
}

export function getWeekDates(selectedDate) {
  const weekStart = addDays(selectedDate, -selectedDate.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function isSameDay(firstDate, secondDate) {
  return getDateKey(firstDate) === getDateKey(secondDate);
}

function calendarInterval(event) {
  const start = event.start_at;
  if (typeof start !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return null;
  const end = event.end_at && event.end_at > start ? event.end_at : null;
  if (end) return { start, end };
  const [year, month, day, hour, minute] = start.match(/\d+/g).map(Number);
  const fallback = new Date(Date.UTC(year, month - 1, day, hour, minute + 30)).toISOString().slice(0, 16);
  return { start, end: fallback };
}

function dayBounds(date) {
  const day = getDateKey(date);
  const next = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() + 1)).toISOString().slice(0, 10);
  return { start: `${day}T00:00`, end: `${next}T00:00` };
}

export function eventOccursOnDate(event, date) {
  const interval = calendarInterval(event);
  if (!interval) return false;
  const bounds = dayBounds(date);
  return interval.start < bounds.end && interval.end > bounds.start;
}

export function getEventDaySegment(event, date) {
  const interval = calendarInterval(event);
  const bounds = dayBounds(date);
  return {
    continuesBefore: interval.start < bounds.start,
    continuesAfter: interval.end > bounds.end,
  };
}

export function getEventPositionForDay(event, date) {
  const interval = calendarInterval(event);
  const bounds = dayBounds(date);
  const visibleStart = interval.start < bounds.start ? bounds.start : interval.start;
  const visibleEnd = interval.end > bounds.end ? bounds.end : interval.end;
  const minutes = (value) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
  const startMinutes = minutes(visibleStart);
  const endMinutes = visibleEnd === bounds.end ? 24 * 60 : minutes(visibleEnd);

  return {
    startMinutes,
    durationMinutes: Math.max(endMinutes - startMinutes, 30),
  };
}

export function formatTime(value) {
  if (!value || !value.includes("T")) {
    return "";
  }

  return value.slice(11, 16);
}

export function formatMonthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatWeekTitle(weekDates) {
  const firstDate = weekDates[0];
  const lastDate = weekDates[6];

  if (firstDate.getFullYear() !== lastDate.getFullYear()) {
    return `${firstDate.getFullYear()}年${firstDate.getMonth() + 1}月${firstDate.getDate()}日 – ${lastDate.getFullYear()}年${lastDate.getMonth() + 1}月${lastDate.getDate()}日`;
  }

  if (firstDate.getMonth() !== lastDate.getMonth()) {
    return `${firstDate.getFullYear()}年${firstDate.getMonth() + 1}月${firstDate.getDate()}日 – ${lastDate.getMonth() + 1}月${lastDate.getDate()}日`;
  }

  return `${firstDate.getFullYear()}年${firstDate.getMonth() + 1}月${firstDate.getDate()}日 – ${lastDate.getDate()}日`;
}

export function formatDayTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_NAMES[date.getDay()]}）`;
}
