import { useState } from "react";
import { WEEKDAY_NAMES, parseDateTime, toDateTimeInputValue } from "../dateUtils";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";
import RouteSearchResult from "./RouteSearchResult";
import { eventToPlace, hasPlaceCoordinates } from "../travelUtils";

function routeTiming(event, direction) {
  if (direction === "outbound") {
    return { type: "departure", at: event.end_at, label: "出発希望時刻" };
  }
  const startDate = parseDateTime(event.start_at);
  const bufferMinutes = event.arrival_buffer_minutes ?? 0;
  return {
    type: "arrival",
    at: startDate
      ? toDateTimeInputValue(new Date(startDate.getTime() - bufferMinutes * 60000))
      : event.start_at,
    label: "到着希望時刻",
  };
}

function formatTiming(value) {
  const date = parseDateTime(value);
  if (!date) return "未設定";
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_NAMES[date.getDay()]}） ${value.slice(11, 16)}`;
}

function RouteSearchModal({ direction, event, initialRouteResult, onBack, onBusyChange, onRegister, onRegisterSuccess, onSearch, onSearchSuccess }) {
  const [placeText, setPlaceText] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const savedEventPlace = eventToPlace(event);
  const [eventPlaceText, setEventPlaceText] = useState(savedEventPlace.name);
  const [selectedEventPlace, setSelectedEventPlace] = useState(
    hasPlaceCoordinates(savedEventPlace) ? savedEventPlace : null,
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [routeResult, setRouteResult] = useState(initialRouteResult);
  const timing = routeTiming(event, direction);
  const eventPlace = selectedEventPlace?.name || eventPlaceText || "未設定";
  const isOutbound = direction === "outbound";

  function routeEventPlace() {
    return selectedEventPlace ?? savedEventPlace;
  }

  function externalPlace() {
    return selectedPlace
      ? {
          name: selectedPlace.name || placeText.trim(),
          address: selectedPlace.address || null,
          place_id: selectedPlace.place_id || null,
          lat: selectedPlace.lat ?? null,
          lng: selectedPlace.lng ?? null,
        }
      : { name: placeText.trim(), address: null, place_id: null, lat: null, lng: null };
  }

  async function handleSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (!placeText.trim()) {
      setErrorMessage(isOutbound ? "目的地を入力してください" : "出発地を入力してください");
      return;
    }
    if (!selectedPlace || !hasPlaceCoordinates(selectedPlace) || !hasPlaceCoordinates(routeEventPlace())) {
      setErrorMessage("経路検索には、予定と検索地点の両方をPlaces候補から選択する必要があります。");
      return;
    }
    setIsSearching(true);
    onBusyChange(true);
    setErrorMessage("");
    setRouteResult(null);
    try {
      const result = await onSearch(event.id, direction, externalPlace(), routeEventPlace());
      setRouteResult(result);
      onSearchSuccess?.(result);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSearching(false);
      onBusyChange(false);
    }
  }

  async function handleRegister(route) {
    setIsRegistering(true);
    onBusyChange(true);
    setErrorMessage("");
    try {
      const saved = await onRegister(event.id, direction, route, externalPlace(), routeEventPlace());
      onRegisterSuccess(saved);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsRegistering(false);
      onBusyChange(false);
    }
  }

  if (routeResult) {
    return <RouteSearchResult errorMessage={errorMessage} isRegistering={isRegistering} route={routeResult} onRegister={handleRegister} onRetry={() => { setRouteResult(null); setErrorMessage(""); }} />;
  }

  return <form className="route-search-form" onSubmit={handleSubmit}>
    {!hasPlaceCoordinates(savedEventPlace) && <div className="modal-form-field"><label htmlFor="route-search-event-place">予定の場所（再選択）</label><PlaceAutocompleteInput id="route-search-event-place" value={eventPlaceText} placeholder="予定の場所を候補から選択" disabled={isSearching} onChange={(value) => { setEventPlaceText(value); setSelectedEventPlace(null); setErrorMessage(""); }} onPlaceSelect={(place) => { setSelectedEventPlace(place); if (place) setEventPlaceText(place.name); }} /><p className="place-autocomplete-status">再検索のため、この予定の場所を候補から選択してください。</p></div>}
    <div className="modal-form-field"><label htmlFor="route-search-place">{isOutbound ? "目的地" : "出発地"}</label><PlaceAutocompleteInput id="route-search-place" value={placeText} placeholder={isOutbound ? "例：自宅" : "例：京都駅"} autoFocus disabled={isSearching} onChange={(value) => { setPlaceText(value); setSelectedPlace(null); setErrorMessage(""); }} onPlaceSelect={(place) => { setSelectedPlace(place); if (place) setPlaceText(place.name); }} /></div>
    <dl className="route-search-summary"><div><dt>出発地</dt><dd>{isOutbound ? eventPlace : placeText || "未設定"}</dd></div><div><dt>目的地</dt><dd>{isOutbound ? placeText || "未設定" : eventPlace}</dd></div><div><dt>{timing.label}</dt><dd>{formatTiming(timing.at)}</dd></div></dl>
    {errorMessage && <p className="modal-error-message" role="alert">{errorMessage}</p>}
    <div className="modal-actions"><button className="secondary-button" type="button" disabled={isSearching} onClick={onBack}>戻る</button><button className="primary-button" type="submit" disabled={isSearching}>{isSearching ? "検索中..." : "検索する"}</button></div>
  </form>;
}

export default RouteSearchModal;
