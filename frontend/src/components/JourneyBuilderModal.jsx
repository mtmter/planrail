import { useMemo, useRef, useState } from "react";
import { requestRouteSearch } from "../routeSearchApi";
import { serializePlacePoint } from "../journeySerializer";
import { formatFare } from "../routeFormatters";
import { getEventArrivalDeadline } from "../eventJourneyTarget";
import {
  addFixedAtRoute, appendFixed, changeFirstOrigin, changeFixedField, changeFixedPlace,
  changeTargetDeadline, changeTargetPlace, clearRouteSelection, createJourneyDraft,
  editPlaceInput, getRouteContext, getSaveState, removeFixed, removeRoute,
  selectPlaceInput, selectRouteCandidate, setRouteCandidates,
} from "../journeyDraft";
import DateTimePicker from "./DateTimePicker";
import PlaceAutocompleteInput from "./PlaceAutocompleteInput";
import RouteDetails from "./RouteDetails";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL;

function eventTarget(event) {
  if (!event) return null;
  const point = serializePlacePoint({
    name: event.location_name || event.destination || "",
    address: event.destination, place_id: event.destination_place_id,
    lat: event.destination_lat, lng: event.destination_lng,
    types: event.destination_place_types,
  });
  return { destination: point, arrival_deadline: getEventArrivalDeadline(event) };
}

function PlaceField({ input, label, disabled, onText, onPoint }) {
  return <div className="modal-form-field">
    <label>{label}</label>
    <PlaceAutocompleteInput value={input.text} placeholder={label} disabled={disabled}
      onChange={onText} onPlaceSelect={(point) => { if (point) onPoint(point); }} />
    {input.point && <small>Places候補: {input.point.name}</small>}
  </div>;
}

function JourneyBuilderModal({ event = null, onClose, onSave }) {
  const [draft, setDraft] = useState(createJourneyDraft);
  const [errorMessage, setErrorMessage] = useState("");
  const [routeMessages, setRouteMessages] = useState({});
  const [isBusy, setIsBusy] = useState(false);
  const revision = useRef(0);
  const target = useMemo(() => eventTarget(event), [event]);
  const save = getSaveState(draft, target, event?.id || null);

  function update(updater) {
    revision.current += 1;
    setErrorMessage("");
    setRouteMessages({});
    setDraft(updater);
  }

  function changePlace(change, input, text) {
    update((current) => change(current, editPlaceInput(input, text)));
  }

  async function search(section) {
    const context = getRouteContext(draft, section.id, target);
    if (!context?.ready) return;
    update((current) => clearRouteSelection(current, section.id));
    const searchRevision = revision.current;
    setIsBusy(true);
    setRouteMessages((current) => ({ ...current, [section.id]: "" }));
    try {
      const result = await requestRouteSearch(`${API_BASE_URL}/route-search`, {
        origin: context.origin, destination: context.destination, time_constraint: context.constraint,
      });
      if (revision.current !== searchRevision) return;
      const next = setRouteCandidates(draft, section.id, result, context);
      const count = next.sections.find((item) => item.id === section.id)?.candidates.length || 0;
      setDraft((current) => setRouteCandidates(current, section.id, result, context));
      if (!count) setRouteMessages((current) => ({ ...current, [section.id]: "指定時刻内の候補がありません" }));
    } catch (error) {
      if (revision.current === searchRevision) setRouteMessages((current) => ({ ...current, [section.id]: error.message }));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveJourney() {
    if (!save.canSave) return;
    setIsBusy(true);
    setErrorMessage("");
    try {
      await onSave(save.journey);
    } catch (error) {
      setErrorMessage(error.message);
      setIsBusy(false);
    }
  }

  return <div className="modal-backdrop">
    <section className="event-details-modal journey-builder-modal" role="dialog" aria-modal="true">
      <div className="modal-header">
        <div><p>移動を計画</p><h2>{event ? `移動: ${event.title}` : "移動予定を追加"}</h2></div>
        <button className="modal-close-button" type="button" disabled={isBusy} onClick={onClose}>×</button>
      </div>
      <div className="journey-builder-content">
        {event && <p className="route-search-guidance">目的地: {target?.destination?.name || "未設定"} ／ 到着期限: {target?.arrival_deadline?.replace("T", " ") || "未設定"}</p>}
        {!event && <>
          <p className="route-search-guidance">目的地と到着日時はROUTE検索に必要です。FIXEDだけを記録する場合は省略できます。</p>
          <PlaceField input={draft.targetPlace} label="目的地" disabled={isBusy}
            onText={(text) => changePlace(changeTargetPlace, draft.targetPlace, text)}
            onPoint={(point) => update((current) => changeTargetPlace(current, selectPlaceInput(point)))} />
          <DateTimePicker id="journey-target-deadline" label="到着したい日時" value={draft.deadline}
            onChange={(value) => update((current) => changeTargetDeadline(current, value))} />
        </>}
        {draft.sections[0]?.kind === "ROUTE" &&
          <PlaceField input={draft.firstOrigin} label="最初の出発地" disabled={isBusy}
            onText={(text) => changePlace(changeFirstOrigin, draft.firstOrigin, text)}
            onPoint={(point) => update((current) => changeFirstOrigin(current, selectPlaceInput(point)))} />}
        {draft.sections.map((section, index) => {
          const context = section.kind === "ROUTE" ? getRouteContext(draft, section.id, target) : null;
          return <section className="journey-builder-section" key={section.id}>
            <div className="journey-builder-section-header">
              <h3>{section.kind === "FIXED" ? "FIXED 固定移動" : `ROUTE ${index + 1}`}</h3>
              <button className="text-button" type="button" disabled={isBusy || (section.kind === "ROUTE" && !draft.sections.some((item) => item.kind === "FIXED"))}
                onClick={() => update((current) => section.kind === "FIXED" ? removeFixed(current, section.id) : removeRoute(current, section.id))}>削除</button>
            </div>
            {section.kind === "FIXED" ? <>
              <PlaceField input={section.origin} label="乗車地点" disabled={isBusy}
                onText={(text) => update((current) => changeFixedPlace(current, section.id, "origin", editPlaceInput(section.origin, text)))}
                onPoint={(point) => update((current) => changeFixedPlace(current, section.id, "origin", selectPlaceInput(point)))} />
              <DateTimePicker id={`fixed-departure-${section.id}`} label="出発日時" value={section.departure_at}
                onChange={(value) => update((current) => changeFixedField(current, section.id, "departure_at", value))} />
              <PlaceField input={section.destination} label="降車地点" disabled={isBusy}
                onText={(text) => update((current) => changeFixedPlace(current, section.id, "destination", editPlaceInput(section.destination, text)))}
                onPoint={(point) => update((current) => changeFixedPlace(current, section.id, "destination", selectPlaceInput(point)))} />
              <DateTimePicker id={`fixed-arrival-${section.id}`} label="到着日時" value={section.arrival_at}
                onChange={(value) => update((current) => changeFixedField(current, section.id, "arrival_at", value))} />
              <input type="text" value={section.label} placeholder="名称（任意）" disabled={isBusy}
                onChange={(e) => update((current) => changeFixedField(current, section.id, "label", e.target.value))} />
            </> : <>
              <p>{context?.origin?.name || "出発地未確定"} → {context?.destination?.name || "目的地未確定"}</p>
              {!context?.ready && <p className="route-search-guidance">両端のPlaces候補と区間の日時が必要です。名前だけの地点からは検索できません。</p>}
              <div className="journey-builder-route-actions">
                <button className="secondary-button" type="button" disabled={isBusy || !context?.ready} onClick={() => search(section)}>{section.route ? "再検索" : "この区間を検索"}</button>
                {section.route && <button className="text-button" type="button" disabled={isBusy} onClick={() => update((current) => clearRouteSelection(current, section.id))}>確定を解除</button>}
                <button className="text-button" type="button" disabled={isBusy} onClick={() => update((current) => addFixedAtRoute(current, section.id))}>この区間に固定移動を挿入</button>
              </div>
              {routeMessages[section.id] && <p className="modal-error-message" role="status">{routeMessages[section.id]}</p>}
              {section.warnings.map((warning, warningIndex) => <p className="route-search-guidance" key={warningIndex}>{warning}</p>)}
              {!!section.candidates.length && <div className="route-candidate-list" aria-label="経路候補">
                {section.candidates.map((candidate, candidateIndex) => <button type="button" key={candidate.candidate_id}
                  className={`route-candidate-card${section.route?.candidate_id === candidate.candidate_id ? " is-active" : ""}`}
                  aria-pressed={section.route?.candidate_id === candidate.candidate_id} disabled={isBusy}
                  onClick={() => update((current) => selectRouteCandidate(current, section.id, candidate.candidate_id))}>
                  <span className="route-candidate-heading"><strong>候補 {candidateIndex + 1}</strong>{candidate.candidate_id === section.recommendedId && <span className="route-recommended-badge">おすすめ</span>}</span>
                  <span>{candidate.departure_at.replace("T", " ")}発 → {candidate.arrival_at.replace("T", " ")}着</span>
                  <span>{candidate.duration_minutes}分</span>
                  {candidate.transfer_count != null && <span>乗換 {candidate.transfer_count}回</span>}
                  {candidate.walk_minutes != null && <span>徒歩 {candidate.walk_minutes}分</span>}
                  {candidate.fare && <span>運賃 {formatFare(candidate.fare)}</span>}
                </button>)}
              </div>}
              {section.route && <RouteDetails route={section.route} />}
            </>}
          </section>;
        })}
        {errorMessage && <p className="modal-error-message" role="alert">{errorMessage}</p>}
        {!save.canSave && <p className="route-search-guidance" role="status">保存するには: {save.reason}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" disabled={isBusy}
            onClick={() => update(appendFixed)}>固定移動を追加</button>
          <button className="primary-button" type="button" disabled={isBusy || !save.canSave} onClick={saveJourney}>Journeyを保存</button>
        </div>
      </div>
    </section>
  </div>;
}

export default JourneyBuilderModal;
