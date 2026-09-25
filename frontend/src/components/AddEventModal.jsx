import { useEffect, useState } from "react";
import { parseDateTime, toDateTimeInputValue } from "../dateUtils";
import DateTimePicker from "./DateTimePicker";
import EventPlaceField from "./EventPlaceField";

function AddEventModal({ initialValues, onClose, onSubmit, embedded = false }) {
  const [title, setTitle] = useState("");
  const [eventStartAt, setEventStartAt] = useState(initialValues.eventStartAt);
  const [eventEndAt, setEventEndAt] = useState(initialValues.eventEndAt);
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [arrivalBufferMinutes, setArrivalBufferMinutes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (embedded) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [embedded, isSubmitting, onClose]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      setErrorMessage("予定タイトルを入力してください");
      return;
    }

    if (!eventStartAt || !eventEndAt) {
      setErrorMessage("開始日時と終了日時を入力してください");
      return;
    }

    if (eventEndAt < eventStartAt) {
      setErrorMessage("終了日時は開始日時以降にしてください");
      return;
    }

    if (
      arrivalBufferMinutes !== "" &&
      (!Number.isInteger(Number(arrivalBufferMinutes)) ||
        Number(arrivalBufferMinutes) < 0)
    ) {
      setErrorMessage("到着余裕時間は0以上の整数で入力してください");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await onSubmit({
        title: title.trim(),
        start_at: eventStartAt,
        end_at: eventEndAt,
        description,
        location_name: (selectedPlace?.name || locationName).trim() || null,
        destination: selectedPlace?.address || null,
        destination_place_id: selectedPlace?.place_id || null,
        destination_lat: selectedPlace?.lat ?? null,
        destination_lng: selectedPlace?.lng ?? null,
        destination_place_types: selectedPlace?.types ?? [],
        arrival_buffer_minutes:
          arrivalBufferMinutes === "" ? null : Number(arrivalBufferMinutes),
      });
    } catch (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
    }
  }

  function handleEventStartChange(nextStartAt) {
    const currentStart = parseDateTime(eventStartAt);
    const currentEnd = parseDateTime(eventEndAt);
    const nextStart = parseDateTime(nextStartAt);
    const duration =
      currentStart && currentEnd && currentEnd >= currentStart
        ? currentEnd.getTime() - currentStart.getTime()
        : 60 * 60 * 1000;

    setEventStartAt(nextStartAt);
    if (nextStart) {
      setEventEndAt(
        toDateTimeInputValue(new Date(nextStart.getTime() + duration)),
      );
    }
  }

  const content = (
    <form className="event-form" onSubmit={handleSubmit}>
      <div className="modal-form-field">
        <label htmlFor="event-title">予定タイトル</label>
        <input id="event-title" type="text" value={title} placeholder="例：ミーティング" autoFocus required onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="modal-date-fields">
        <DateTimePicker id="event-start-at" label="開始日時" value={eventStartAt} onChange={handleEventStartChange} />
        <DateTimePicker id="event-end-at" label="終了日時" value={eventEndAt} min={eventStartAt} onChange={setEventEndAt} />
      </div>
      <EventPlaceField id="event-location" value={locationName} selectedPlace={selectedPlace} disabled={isSubmitting}
        onChange={(next) => { setLocationName(next); setSelectedPlace(null); }}
        onPlaceSelect={(place) => { setSelectedPlace(place); if (place) setLocationName(place.name); }} />
      <div className="modal-form-field"><label htmlFor="event-arrival-buffer-minutes">到着余裕時間（分） <span>任意</span></label>
        <input id="event-arrival-buffer-minutes" type="number" min="0" step="1" inputMode="numeric" value={arrivalBufferMinutes}
          placeholder="例：10" onChange={(event) => setArrivalBufferMinutes(event.target.value)} /></div>
      <div className="modal-form-field"><label htmlFor="event-description">説明 <span>任意</span></label>
        <textarea id="event-description" value={description} placeholder="補足があれば入力してください" onChange={(event) => setDescription(event.target.value)} /></div>
      {errorMessage && <p className="modal-error-message" role="alert">{errorMessage}</p>}
      <div className="modal-actions"><button className="secondary-button" type="button" disabled={isSubmitting} onClick={onClose}>キャンセル</button>
        <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "追加中..." : "追加"}</button></div>
    </form>
  );

  if (embedded) return <div className="add-event-content">{content}</div>;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <section
        className="add-event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-heading"
      >
        <div className="modal-header">
          <div>
            <p>新しく追加</p>
            <h2 id="add-event-heading">予定を追加</h2>
          </div>
          <button
            className="modal-close-button"
            type="button"
            aria-label="閉じる"
            disabled={isSubmitting}
            onClick={onClose}
          >
            ×
          </button>
        </div>


        {content}
      </section>
    </div>
  );
}

export default AddEventModal;
