import JourneyDetails from "./JourneyDetails";

function placesMatch(firstPlace, secondPlace) {
  if (!firstPlace || !secondPlace) return firstPlace === secondPlace;
  if (firstPlace.place_id || secondPlace.place_id) {
    return firstPlace.place_id === secondPlace.place_id;
  }
  return (
    firstPlace.lat === secondPlace.lat &&
    firstPlace.lng === secondPlace.lng &&
    firstPlace.address === secondPlace.address
  );
}

function eventPlace(event) {
  if (!event) return null;
  if (
    !event.destination_place_id &&
    (event.destination_lat === null || event.destination_lat === undefined) &&
    (event.destination_lng === null || event.destination_lng === undefined)
  ) {
    return null;
  }
  return {
    place_id: event.destination_place_id || null,
    lat: event.destination_lat ?? null,
    lng: event.destination_lng ?? null,
    address: event.destination || null,
  };
}

function eventDeadline(event) {
  if (!event?.start_at) return "";
  const [datePart, timePart] = event.start_at.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const deadline = new Date(year, month - 1, day, hour, minute);
  deadline.setMinutes(deadline.getMinutes() - (event.arrival_buffer_minutes || 0));
  const pad = (value) => String(value).padStart(2, "0");
  return `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
}

function JourneyDetailsModal({ journey, event = null, onClose, onEdit }) {
  const needsReplan = Boolean(
    event &&
      (!placesMatch(journey.target?.destination, eventPlace(event)) ||
        journey.target?.arrival_deadline !== eventDeadline(event)),
  );
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="event-details-modal" role="dialog" aria-modal="true">
        <div className="modal-header"><div><p>移動予定</p><h2>Journey詳細</h2></div><button className="modal-close-button" type="button" onClick={onClose}>×</button></div>
        <JourneyDetails
          journey={journey}
          onPlan={onEdit}
          replanWarning={needsReplan ? "予定の目的地または到着期限が変更されています。移動を再計画してください。" : ""}
        />
      </section>
    </div>
  );
}

export default JourneyDetailsModal;
