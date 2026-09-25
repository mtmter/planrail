import JourneyDetails from "./JourneyDetails";
import { getEventArrivalDeadline } from "../eventJourneyTarget";
import { journeyDisplayName } from "../journeySerializer";

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

function JourneyDetailsModal({ journey, event = null, onClose, onEdit }) {
  const needsReplan = Boolean(
    event &&
      (!placesMatch(journey.target?.destination, eventPlace(event)) ||
        journey.target?.arrival_deadline !== getEventArrivalDeadline(event)),
  );
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="event-details-modal" role="dialog" aria-modal="true">
        <div className="modal-header"><div><p>移動予定</p><h2>{journeyDisplayName(journey, event)}</h2></div><button className="modal-close-button" type="button" onClick={onClose}>×</button></div>
        <JourneyDetails
          journey={journey}
          onPlan={onEdit}
          isSearchDisabled={Boolean(event && (!Number.isFinite(event.destination_lat) || !Number.isFinite(event.destination_lng)))}
          replanWarning={needsReplan ? "予定の目的地または到着期限が変更されています。移動を再計画してください。" : ""}
        />
      </section>
    </div>
  );
}

export default JourneyDetailsModal;
