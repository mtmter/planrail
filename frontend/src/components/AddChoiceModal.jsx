import { useEffect, useState } from "react";
import AddEventModal from "./AddEventModal";
import { JourneyBuilderContent } from "./JourneyBuilderModal";

export default function AddChoiceModal({ initialValues, onCreateEvent, onCreateJourney, onClose }) {
  const [tab, setTab] = useState("event");
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", handleKeyDown); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="event-details-modal add-choice-modal" role="dialog" aria-modal="true">
      <div className="modal-header"><div><p>新しく追加</p><h2>{tab === "event" ? "予定を追加" : "移動予定を追加"}</h2></div>
        <button className="modal-close-button" type="button" onClick={onClose}>×</button></div>
      <div className="item-type-tabs" role="tablist" aria-label="追加するもの">
        <button type="button" role="tab" aria-selected={tab === "event"} className={tab === "event" ? "is-active" : ""} onClick={() => setTab("event")}>予定</button>
        <button type="button" role="tab" aria-selected={tab === "journey"} className={tab === "journey" ? "is-active" : ""} onClick={() => setTab("journey")}>移動予定</button>
      </div>
      <div hidden={tab !== "event"}><AddEventModal embedded initialValues={initialValues} onClose={onClose} onSubmit={onCreateEvent} /></div>
      <div hidden={tab !== "journey"}><JourneyBuilderContent onCancel={onClose} onSave={onCreateJourney} /></div>
    </section>
  </div>;
}
