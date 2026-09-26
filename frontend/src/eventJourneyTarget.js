export function getEventArrivalDeadline(event) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(event?.start_at || "");
  if (!match) return "";
  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute - (event.arrival_buffer_minutes ?? 0)))
    .toISOString().slice(0, 16);
}

export function hasSearchableDestination(event) {
  return Number.isFinite(event?.destination_lat) && Number.isFinite(event?.destination_lng);
}

export function getEventDestination(event) {
  if (!hasSearchableDestination(event)) return null;
  return {
    name: event.location_name ?? "",
    address: event.destination ?? "",
    place_id: event.destination_place_id ?? "",
    lat: event.destination_lat,
    lng: event.destination_lng,
    types: event.destination_place_types ?? [],
  };
}

export function placesMatch(firstPlace, secondPlace) {
  if (!firstPlace || !secondPlace) return firstPlace === secondPlace;
  if (firstPlace.place_id || secondPlace.place_id) {
    return firstPlace.place_id === secondPlace.place_id;
  }
  return firstPlace.lat === secondPlace.lat &&
    firstPlace.lng === secondPlace.lng &&
    firstPlace.address === secondPlace.address;
}

export function eventJourneyTargetChanged(previousEvent, nextEvent) {
  return !placesMatch(getEventDestination(previousEvent), getEventDestination(nextEvent)) ||
    getEventArrivalDeadline(previousEvent) !== getEventArrivalDeadline(nextEvent);
}
