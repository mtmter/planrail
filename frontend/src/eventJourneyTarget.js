export function getEventArrivalDeadline(event) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(event?.start_at || "");
  if (!match) return "";
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute - (event.arrival_buffer_minutes ?? 0)))
    .toISOString().slice(0, 16);
}
