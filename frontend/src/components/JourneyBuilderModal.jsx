import { useMemo, useState } from "react";
import { parseDateTime } from "../dateUtils";
import { requestRouteSearch } from "../routeSearchApi";
import { serializePlacePoint } from "../journeySerializer";
import DateTimePicker from "./DateTimePicker";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";
import RouteDetails from "./RouteDetails";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL;

function pointFromEvent(event) {
  return serializePlacePoint({
    name: event.location_name || event.destination || "",
    address: event.destination,
    place_id: event.destination_place_id,
    lat: event.destination_lat,
    lng: event.destination_lng,
    types: event.destination_place_types,
  });
}

function JourneyBuilderModal({ event = null, onClose, onSave }) {
  const targetPoint = useMemo(
    () => (event ? pointFromEvent(event) : null),
    [event],
  );
  const targetDeadline = event
    ? (() => {
        const start = parseDateTime(event.start_at);
        if (!start) return "";
        start.setMinutes(start.getMinutes() - (event.arrival_buffer_minutes || 0));
        const pad = (value) => String(value).padStart(2, "0");
        return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
      })()
    : "";
  const [standaloneTarget, setStandaloneTarget] = useState({
    point: null,
    deadline: "",
  });
  const [origin, setOrigin] = useState("");
  const [originPoint, setOriginPoint] = useState(null);
  const [sections, setSections] = useState([
    { kind: "ROUTE", origin: null, destination: targetPoint, route: null },
  ]);
  const [searchResult, setSearchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const target = useMemo(
    () =>
      event
        ? { destination: targetPoint, arrival_deadline: targetDeadline }
        : standaloneTarget.point && standaloneTarget.deadline
          ? {
              destination: standaloneTarget.point,
              arrival_deadline: standaloneTarget.deadline,
            }
          : null,
    [event, standaloneTarget, targetDeadline, targetPoint],
  );

  const activeRouteIndex = sections.findIndex(
    (section) => section.kind === "ROUTE" && !section.route,
  );
  const activeRoute = activeRouteIndex >= 0 ? sections[activeRouteIndex] : null;

  const routeOrigin = useMemo(() => {
    if (activeRouteIndex > 0) {
      return sections[activeRouteIndex - 1].destination;
    }
    return originPoint;
  }, [activeRouteIndex, originPoint, sections]);

  const routeDestination = useMemo(() => {
    const nextSection = sections[activeRouteIndex + 1];
    return nextSection?.origin || target?.destination || activeRoute?.destination;
  }, [activeRoute, activeRouteIndex, sections, target]);

  function updateSection(index, patch) {
    const currentSection = sections[index];
    setSections((current) => {
      const updated = current.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section,
      );
      if (currentSection?.kind === "FIXED") {
        [index - 1, index + 1].forEach((neighborIndex) => {
          if (updated[neighborIndex]?.kind === "ROUTE") {
            updated[neighborIndex] = { ...updated[neighborIndex], route: null };
          }
        });
      }
      return updated;
    });
    if (currentSection?.kind === "FIXED") {
      setSearchResult(null);
    }
  }

  function addFixedSection() {
    setSections((current) => [
      ...current,
      {
        kind: "FIXED",
        origin: null,
        destination: null,
        departure_at: "",
        arrival_at: "",
        label: "",
      },
      { kind: "ROUTE", origin: null, destination: target?.destination || null, route: null },
    ]);
    setSearchResult(null);
  }

  function removeRouteSection(index) {
    setSections((current) => {
      if (
        current[index]?.kind !== "ROUTE" ||
        current[index]?.route ||
        !current.some((section) => section.kind === "FIXED")
      ) {
        return current;
      }
      return current.filter((_, sectionIndex) => sectionIndex !== index);
    });
    setSearchResult(null);
    setErrorMessage("");
  }

  async function searchRoute() {
    if (!activeRoute || !routeOrigin || !routeDestination) {
      setErrorMessage("ROUTE区間の出発地・目的地をPlaces候補から選択してください");
      return;
    }
    if (
      !Number.isFinite(routeOrigin.lat) ||
      !Number.isFinite(routeOrigin.lng) ||
      !Number.isFinite(routeDestination.lat) ||
      !Number.isFinite(routeDestination.lng)
    ) {
      setErrorMessage("ROUTE区間の両端でPlaces候補を選択してください");
      return;
    }
    const nextFixed = sections[activeRouteIndex + 1];
    const previousFixed = sections[activeRouteIndex - 1];
    const constraint = previousFixed?.kind === "FIXED"
      ? {
          type: "departure",
          at: previousFixed.arrival_at,
          latest_arrival_at: nextFixed?.kind === "FIXED"
            ? nextFixed.departure_at
            : target?.arrival_deadline,
        }
      : nextFixed?.kind === "FIXED"
        ? { type: "arrival", at: nextFixed.departure_at }
        : { type: "arrival", at: target?.arrival_deadline };
    if (!constraint.at) {
      setErrorMessage("到着希望日時を入力してください");
      return;
    }
    setIsBusy(true);
    setErrorMessage("");
    try {
      const result = await requestRouteSearch(`${API_BASE_URL}/route-search`, {
        origin: routeOrigin,
        destination: routeDestination,
        time_constraint: constraint,
      });
      const recommendedRoute = result.candidates.find(
        (candidate) => candidate.candidate_id === result.recommended_candidate_id,
      ) ?? result.candidates[0];
      updateSection(activeRouteIndex, {
        origin: routeOrigin,
        destination: routeDestination,
        route: recommendedRoute,
      });
      setSearchResult({
        ...result,
        routeIndex: activeRouteIndex,
        origin: routeOrigin,
        destination: routeDestination,
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  function chooseRoute(route) {
    const routeIndex = searchResult?.routeIndex ?? activeRouteIndex;
    updateSection(routeIndex, {
      origin: searchResult?.origin ?? routeOrigin,
      destination: searchResult?.destination ?? routeDestination,
      route,
    });
  }

  async function handleSave() {
    const incomplete = sections.some(
      (section) =>
        section.kind === "ROUTE"
          ? !section.route
          : !section.origin || !section.destination || !section.departure_at || !section.arrival_at,
    );
    if (!sections.length || incomplete) {
      setErrorMessage("すべての移動区間を確定してください");
      return;
    }
    if (sections.every((section) => section.kind === "FIXED") && event) {
      const finalSection = sections[sections.length - 1];
      const targetPlaceId = target?.destination?.place_id;
      const finalPlaceId = finalSection.destination?.place_id;
      if (!targetPlaceId || finalPlaceId !== targetPlaceId) {
        setErrorMessage("最後の固定移動の降車地点を予定の目的地に合わせてください");
        return;
      }
      if (target.arrival_deadline && finalSection.arrival_at > target.arrival_deadline) {
        setErrorMessage("固定移動の到着日時を予定の到着期限までにしてください");
        return;
      }
    }
    const first = sections[0];
    const last = sections[sections.length - 1];
    const departureAt = first.kind === "ROUTE" ? first.route.departure_at : first.departure_at;
    const arrivalAt = last.kind === "ROUTE" ? last.route.arrival_at : last.arrival_at;
    setIsBusy(true);
    try {
      await onSave({
        event_id: event?.id || null,
        target,
        departure_at: departureAt,
        arrival_at: arrivalAt,
        sections,
      });
    } catch (error) {
      setErrorMessage(error.message);
      setIsBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="event-details-modal journey-builder-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div><p>移動を計画</p><h2>{event ? `移動: ${event.title}` : "移動予定を追加"}</h2></div>
          <button className="modal-close-button" type="button" disabled={isBusy} onClick={onClose}>×</button>
        </div>
        <div className="journey-builder-content">
          {!event && (
            <>
              <div className="modal-form-field">
                <label>目的地</label>
                <PlaceAutocompleteInput value={standaloneTarget.point?.name || ""} placeholder="到着したい場所" disabled={isBusy} onChange={() => setStandaloneTarget((current) => ({ ...current, point: null }))} onPlaceSelect={(place) => setStandaloneTarget((current) => ({ ...current, point: place }))} />
              </div>
              <DateTimePicker id="journey-target-deadline" label="到着したい日時" value={standaloneTarget.deadline} onChange={(value) => setStandaloneTarget((current) => ({ ...current, deadline: value }))} />
            </>
          )}
          <div className="modal-form-field">
            <label>最初の出発地</label>
            <PlaceAutocompleteInput value={origin} placeholder="出発地" disabled={isBusy} onChange={(value) => { setOrigin(value); setOriginPoint(null); }} onPlaceSelect={(place) => { setOrigin(place?.name || ""); setOriginPoint(place); }} />
          </div>
          {sections.map((section, index) => (
            <section className="journey-builder-section" key={`${section.kind}-${index}`}>
              <h3>{section.kind === "FIXED" ? "FIXED 固定移動" : `ROUTE ${index + 1}`}</h3>
              {section.kind === "FIXED" ? (
                <>
                  <PlaceAutocompleteInput value={section.origin?.name || ""} placeholder="乗車地点" disabled={isBusy} onChange={() => updateSection(index, { origin: null })} onPlaceSelect={(place) => updateSection(index, { origin: place })} />
                  <DateTimePicker id={`fixed-departure-${index}`} label="出発日時" value={section.departure_at} onChange={(value) => updateSection(index, { departure_at: value })} />
                  <PlaceAutocompleteInput value={section.destination?.name || ""} placeholder="降車地点" disabled={isBusy} onChange={() => updateSection(index, { destination: null })} onPlaceSelect={(place) => updateSection(index, { destination: place })} />
                  <DateTimePicker id={`fixed-arrival-${index}`} label="到着日時" value={section.arrival_at} onChange={(value) => updateSection(index, { arrival_at: value })} />
                  <input type="text" value={section.label || ""} placeholder="名称（任意）" disabled={isBusy} onChange={(e) => updateSection(index, { label: e.target.value })} />
                </>
              ) : section.route ? (
                <RouteDetails route={section.route} />
              ) : index === activeRouteIndex ? (
                <div className="journey-builder-route-actions"><p>{routeOrigin?.name || "出発地未設定"} → {routeDestination?.name || "目的地未設定"}</p><button className="primary-button" type="button" disabled={isBusy} onClick={searchRoute}>{isBusy ? "検索中..." : "この区間を検索"}</button><button className="text-button" type="button" disabled={isBusy} onClick={() => removeRouteSection(index)}>このROUTEを削除</button></div>
              ) : <div className="journey-builder-route-actions"><p>この区間を検索するには前の区間を確定してください。</p><button className="text-button" type="button" disabled={isBusy} onClick={() => removeRouteSection(index)}>このROUTEを削除</button></div>}
            </section>
          ))}
          {searchResult && (
            <section className="journey-builder-candidates">
              <h3>候補を選択</h3>
              {searchResult.warnings?.map((warning) => <p className="route-search-guidance" key={warning}>{warning}</p>)}
              {searchResult.candidates.map((candidate) => {
                const selectedRoute = sections[searchResult.routeIndex]?.route;
                const isSelected = selectedRoute?.candidate_id === candidate.candidate_id;
                return <button className={isSelected ? "is-selected" : ""} type="button" key={candidate.candidate_id} disabled={isBusy} onClick={() => chooseRoute(candidate)}><strong>{candidate.departure_at.slice(11, 16)} → {candidate.arrival_at.slice(11, 16)}</strong><span>{candidate.duration_minutes}分</span></button>;
              })}
            </section>
          )}
          {errorMessage && <p className="modal-error-message" role="alert">{errorMessage}</p>}
          <div className="modal-actions"><button className="secondary-button" type="button" disabled={isBusy} onClick={addFixedSection}>固定移動を追加</button><button className="primary-button" type="button" disabled={isBusy} onClick={handleSave}>Journeyを保存</button></div>
        </div>
      </section>
    </div>
  );
}

export default JourneyBuilderModal;
