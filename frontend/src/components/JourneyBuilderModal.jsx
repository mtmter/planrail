import { useMemo, useRef, useState } from "react";
import { requestRouteSearch } from "../routeSearchApi";
import { serializePlacePoint } from "../journeySerializer";
import { getEventArrivalDeadline } from "../eventJourneyTarget";
import { addFixed, buildPlan, createInput, initialSavedPreview, journeyForSave, searchAllGaps, searchFingerprint, selectCandidate, selectedPlace, sortedFixed, typedPlace } from "../journeyFlow";
import DateTimePicker from "./DateTimePicker";
import JourneyTimeline from "./JourneyTimeline";
import SelectedPlaceField from "./SelectedPlaceField";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL;

function eventTarget(event) {
  if (!event) return null;
  return { destination: serializePlacePoint({
    name: event.location_name || event.destination || "", address: event.destination,
    place_id: event.destination_place_id, lat: event.destination_lat, lng: event.destination_lng,
    types: event.destination_place_types,
  }), arrival_deadline: getEventArrivalDeadline(event) };
}

function PlaceField({ id, label, input, disabled, onChange, readOnly = false }) {
  return <SelectedPlaceField id={id} label={label} value={input.text} selectedPlace={input.point}
    disabled={disabled} readOnly={readOnly} onChange={(text) => onChange(typedPlace(text))}
    onPlaceSelect={(point) => onChange(point ? selectedPlace(point) : typedPlace(input.text))} />;
}

export function JourneyBuilderContent({ event = null, journey = null, onSave, onCancel }) {
  const target = useMemo(() => eventTarget(event), [event]);
  const [input, setInput] = useState(() => createInput(journey));
  const [result, setResult] = useState(() => {
    const initial = createInput(journey);
    const sections = initialSavedPreview(journey, initial, eventTarget(event));
    return sections ? { sections, fingerprint: searchFingerprint(initial, eventTarget(event)), hasCache: false } : null;
  });
  const [phase, setPhase] = useState(() => initialSavedPreview(journey, createInput(journey), eventTarget(event)) ? "preview" : "input");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ complete: 0, total: 0 });
  const [saving, setSaving] = useState(false);
  const runId = useRef(0);
  const fingerprint = searchFingerprint(input, target);
  const dirty = Boolean(result && result.fingerprint !== fingerprint);
  const hasFailures = result?.sections.some((section) => section.kind === "ROUTE" && (!section.route || section.error));
  const canConfirm = phase === "preview" && result && !dirty && !hasFailures && !saving;
  const displaySections = result?.sections.map((section) => section.kind === "FIXED"
    ? { ...section, label: input.fixed.find((item) => `fixed-${item.id}` === section.key)?.label ?? section.label }
    : section);

  function updateInput(updater) {
    runId.current += 1;
    setInput(updater);
    setError("");
  }

  function updatePlace(field, next) {
    updateInput((current) => ({ ...current, [field]: next }));
  }

  function updateFixed(id, field, next) {
    updateInput((current) => ({ ...current, fixed: current.fixed.map((item) => item.id === id ? { ...item, [field]: next } : item) }));
  }

  async function search() {
    if (phase === "searching" || saving) return;
    let plan;
    try { plan = buildPlan(input, target); }
    catch (searchError) { setError(searchError.message); return; }
    const currentRun = ++runId.current;
    const currentFingerprint = fingerprint;
    const total = plan.filter((section) => section.kind === "ROUTE").length;
    setProgress({ complete: 0, total });
    setError("");
    setPhase("searching");
    const next = await searchAllGaps(plan, (section) => requestRouteSearch(`${API_BASE_URL}/route-search`, {
      origin: section.origin, destination: section.destination, time_constraint: section.constraint,
    }), (complete, count) => setProgress({ complete, total: count }), () => runId.current === currentRun);
    if (runId.current !== currentRun) return;
    setResult({ sections: next, fingerprint: currentFingerprint, hasCache: true });
    setPhase("preview");
  }

  async function confirm() {
    if (!canConfirm) return;
    try {
      const saved = journeyForSave(input, result.sections, target, event?.id || null);
      setSaving(true);
      setError("");
      await onSave(saved, journey?.id || null);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  }

  return <div className="journey-builder-content">
    {phase === "input" && <>
      <PlaceField id="journey-origin" label="出発地" input={input.origin} disabled={saving} onChange={(next) => updatePlace("origin", next)} />
      {event ? <>
        <PlaceField id="journey-target" label="目的地" input={selectedPlace(target?.destination)} readOnly />
        <div className="modal-form-field"><label>到着期限</label><p>{target?.arrival_deadline?.replace("T", " ") || "未設定"}</p></div>
      </> : <>
        <PlaceField id="journey-target" label="目的地" input={input.destination} disabled={saving} onChange={(next) => updatePlace("destination", next)} />
        <DateTimePicker id="journey-deadline" label="到着したい日時" value={input.deadline}
          onChange={(deadline) => updateInput((current) => ({ ...current, deadline }))} />
      </>}
      {sortedFixed(input).map((fixed) => <section className="journey-fixed-input" key={fixed.id}>
        <div className="journey-builder-section-header"><h3>固定移動</h3><button className="text-button" type="button"
          onClick={() => updateInput((current) => ({ ...current, fixed: current.fixed.filter((item) => item.id !== fixed.id) }))}>削除</button></div>
        <PlaceField id={`fixed-origin-${fixed.id}`} label="乗車地点" input={fixed.origin} onChange={(next) => updateFixed(fixed.id, "origin", next)} />
        <DateTimePicker id={`fixed-departure-${fixed.id}`} label="出発日時" value={fixed.departure_at} onChange={(next) => updateFixed(fixed.id, "departure_at", next)} />
        <PlaceField id={`fixed-destination-${fixed.id}`} label="降車地点" input={fixed.destination} onChange={(next) => updateFixed(fixed.id, "destination", next)} />
        <DateTimePicker id={`fixed-arrival-${fixed.id}`} label="到着日時" value={fixed.arrival_at} onChange={(next) => updateFixed(fixed.id, "arrival_at", next)} />
        <div className="modal-form-field"><label htmlFor={`fixed-label-${fixed.id}`}>名称 <span>任意</span></label>
          <input id={`fixed-label-${fixed.id}`} value={fixed.label} onChange={(event) => updateFixed(fixed.id, "label", event.target.value)} /></div>
      </section>)}
      <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => updateInput(addFixed)}>固定移動を追加</button>
        {result && !dirty && !hasFailures && <button className="secondary-button" type="button" onClick={() => setPhase("preview")}>確認に戻る</button>}
        <button className="primary-button" type="button" onClick={search}>{result ? "経路を再検索" : "経路を検索"}</button></div>
    </>}
    {phase === "searching" && <div className="journey-searching" role="status">
      <span className="journey-spinner" aria-hidden="true" /><p>経路を検索中...</p>
      <p>全{progress.total}区間中{progress.complete}区間を検索しました</p>
      <button className="primary-button" type="button" disabled>経路を検索中...</button>
    </div>}
    {phase === "preview" && result && <>
      <JourneyTimeline sections={displaySections} onCandidateChange={result.hasCache ? (key, candidateId) =>
        setResult((current) => ({ ...current, sections: selectCandidate(current.sections, key, candidateId) })) : null} />
      {dirty && <p className="route-search-guidance" role="status">条件が変わりました。経路を再検索してください。</p>}
      {hasFailures && <p className="route-search-guidance" role="status">検索できなかった地点間があります。条件を確認するか、全区間を再検索してください。</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => setPhase("input")}>条件を変更</button>
        {hasFailures && <button className="secondary-button" type="button" disabled={saving} onClick={search}>経路を再検索</button>}
        {!result.hasCache && !dirty && result.sections.some((section) => section.kind === "ROUTE") &&
          <button className="secondary-button" type="button" disabled={saving} onClick={search}>候補を再検索</button>}
        <button className="primary-button" type="button" disabled={!canConfirm} onClick={confirm}>{saving ? "保存中..." : "この移動予定を確定"}</button></div>
    </>}
    {error && <p className="modal-error-message" role="alert">{error}</p>}
    {onCancel && <button className="text-button" type="button" disabled={saving || phase === "searching"} onClick={onCancel}>戻る</button>}
  </div>;
}

export default function JourneyBuilderModal({ event = null, journey = null, onClose, onSave }) {
  return <div className="modal-backdrop" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
    <section className="event-details-modal journey-builder-modal" role="dialog" aria-modal="true">
      <div className="modal-header"><div><p>移動予定</p><h2>{journey ? "移動予定を編集" : "移動予定を追加"}</h2></div>
        <button className="modal-close-button" type="button" onClick={onClose}>×</button></div>
      <JourneyBuilderContent event={event} journey={journey} onSave={onSave} />
    </section>
  </div>;
}
