import { useEffect, useRef, useState } from "react";
import { WEEKDAY_NAMES, parseDateTime } from "../dateUtils";
import DateTimePicker from "./DateTimePicker";
import EventPlaceField from "./EventPlaceField";
import PreparationChecklist from "./PreparationChecklist";
import { JourneyBuilderContent } from "./JourneyBuilderModal";
import JourneyDetails from "./JourneyDetails";
import { getEventArrivalDeadline, getEventDestination, hasSearchableDestination, placesMatch } from "../eventJourneyTarget";

function formatEventDateTime(value) {
  const date = parseDateTime(value);

  if (!date) {
    return "未設定";
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_NAMES[date.getDay()]}） ${value.slice(11, 16)}`;
}

function hasCoordinateValue(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function createGoogleMapsUrl(event) {
  const hasCoordinates =
    hasCoordinateValue(event.destination_lat) &&
    hasCoordinateValue(event.destination_lng);
  const coordinates = hasCoordinates
    ? `${event.destination_lat},${event.destination_lng}`
    : "";
  const query = event.destination_place_id
    ? event.location_name ||
      coordinates ||
      event.destination ||
      event.destination_place_id
    : event.destination || event.location_name || coordinates;

  if (!query) {
    return null;
  }

  const searchParameters = new URLSearchParams({
    api: "1",
    query,
  });

  if (event.destination_place_id) {
    searchParameters.set("query_place_id", event.destination_place_id);
  }

  return `https://www.google.com/maps/search/?${searchParameters}`;
}

function EventDetailsModal({
  event,
  onClose,
  onPreparationAdd,
  onPreparationDelete,
  onPreparationUpdate,
  onDelete,
  onJourneyLoad,
  onJourneySave,
  onUpdate,
  preparations,
  initialMode = "details",
}) {
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState(event.title);
  const [startAt, setStartAt] = useState(event.start_at ?? "");
  const [endAt, setEndAt] = useState(event.end_at ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [locationName, setLocationName] = useState(
    event.location_name || event.destination || "",
  );
  const [selectedPlace, setSelectedPlace] = useState(() =>
    getEventDestination(event),
  );
  const [arrivalBufferMinutes, setArrivalBufferMinutes] = useState(
    event.arrival_buffer_minutes?.toString() ?? "",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [journey, setJourney] = useState(null);
  const [isJourneyLoading, setIsJourneyLoading] = useState(true);
  const journeyInvalidatedRef = useRef(false);

  const isBusy = isSubmitting;
  const googleMapsUrl = createGoogleMapsUrl(event);
  const hasCoordinates =
    hasCoordinateValue(event.destination_lat) &&
    hasCoordinateValue(event.destination_lng);
  const placeLabel =
    event.location_name ||
    event.destination ||
    (hasCoordinates
      ? `${event.destination_lat}, ${event.destination_lng}`
      : event.destination_place_id
        ? "Google Mapsで場所を表示"
        : "未設定");
  const canSearchRoute = hasSearchableDestination(event);
  const journeyNeedsReplan = Boolean(
    journey &&
      (!placesMatch(journey.target?.destination, getEventDestination(event)) ||
        journey.target?.arrival_deadline !== getEventArrivalDeadline(event)),
  );
  useEffect(() => {
    let shouldIgnoreResult = false;

    async function loadJourney() {
      try {
        const loadedJourney = await onJourneyLoad(`event-${event.id}`);
        if (!shouldIgnoreResult && !journeyInvalidatedRef.current) {
          setJourney(loadedJourney);
        }
      } catch (loadError) {
        if (!shouldIgnoreResult) {
          setErrorMessage(loadError.message);
        }
      } finally {
        if (!shouldIgnoreResult) {
          setIsJourneyLoading(false);
        }
      }
    }

    loadJourney();

    return () => {
      shouldIgnoreResult = true;
    };
  }, [event.id, onJourneyLoad]);

  useEffect(() => {
    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape" && !isBusy) {
        if (mode === "route") {
          setMode("details");
        } else {
          onClose();
        }
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, mode, onClose]);

  function resetForm() {
    setTitle(event.title);
    setStartAt(event.start_at ?? "");
    setEndAt(event.end_at ?? "");
    setDescription(event.description ?? "");
    setLocationName(event.location_name || event.destination || "");
    setSelectedPlace(getEventDestination(event));
    setArrivalBufferMinutes(
      event.arrival_buffer_minutes?.toString() ?? "",
    );
    setErrorMessage("");
  }

  function startEditing() {
    resetForm();
    setMode("edit");
  }

  async function handleUpdate(submitEvent) {
    submitEvent.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!title.trim()) {
      setErrorMessage("予定タイトルを入力してください");
      return;
    }

    if (!startAt || !endAt) {
      setErrorMessage("開始日時と終了日時を入力してください");
      return;
    }

    if (endAt < startAt) {
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
      const result = await onUpdate(event.id, {
        title: title.trim(),
        start_at: startAt,
        end_at: endAt,
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
      if (result.journeyInvalidated) {
        journeyInvalidatedRef.current = true;
        setJourney(null);
      }
      setMode("details");
    } catch (updateError) {
      setErrorMessage(updateError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await onDelete(event.id);
    } catch (deleteError) {
      setErrorMessage(deleteError.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget && !isBusy) {
          onClose();
        }
      }}
    >
      <section
        className="event-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-heading"
      >
        <div className="modal-header">
          <div>
            <p>予定詳細</p>
            <h2 id="event-details-heading">
              {mode === "edit"
                ? "予定を編集"
                : mode === "route"
                  ? "移動を計画"
                  : event.title}
            </h2>
          </div>
          <button
            className="modal-close-button"
            type="button"
            aria-label="閉じる"
            disabled={isBusy}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {mode === "route" ? (
          <JourneyBuilderContent
            event={event}
            journey={journey}
            onCancel={() => setMode("details")}
            onSave={async (nextJourney) => {
              const savedJourney = await onJourneySave(nextJourney);
              setJourney(savedJourney);
              setErrorMessage("");
              setMode("details");
            }}
          />
        ) : mode === "edit" ? (
          <form
            className="event-form event-edit-form"
            onSubmit={handleUpdate}
          >
            <div className="modal-form-field">
              <label htmlFor="edit-event-title">予定タイトル</label>
              <input
                id="edit-event-title"
                type="text"
                value={title}
                autoFocus
                required
                onChange={(inputEvent) => setTitle(inputEvent.target.value)}
              />
            </div>

            <div className="modal-date-fields">
              <DateTimePicker
                id="edit-event-start-at"
                label="開始日時"
                value={startAt}
                onChange={setStartAt}
              />
              <DateTimePicker
                id="edit-event-end-at"
                label="終了日時"
                value={endAt}
                min={startAt}
                onChange={setEndAt}
              />
            </div>

            <div className="modal-form-field">
              <label htmlFor="edit-event-description">
                説明 <span>任意</span>
              </label>
              <textarea
                id="edit-event-description"
                value={description}
                onChange={(inputEvent) =>
                  setDescription(inputEvent.target.value)
                }
              />
            </div>

            <EventPlaceField
              id="edit-event-location"
              value={locationName}
              selectedPlace={selectedPlace}
              disabled={isBusy}
              onChange={(nextLocationName) => {
                setLocationName(nextLocationName);
                setSelectedPlace(null);
              }}
              onPlaceSelect={(place) => {
                setSelectedPlace(place);
                if (place) {
                  setLocationName(place.name);
                }
              }}
            />

            <div className="modal-form-field">
              <label htmlFor="edit-event-arrival-buffer">
                到着余裕時間（分） <span>任意</span>
              </label>
              <input
                id="edit-event-arrival-buffer"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={arrivalBufferMinutes}
                onChange={(inputEvent) =>
                  setArrivalBufferMinutes(inputEvent.target.value)
                }
              />
            </div>

            {errorMessage && (
              <p className="modal-error-message" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  resetForm();
                  setMode("details");
                }}
              >
                キャンセル
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={isBusy}
              >
                {isSubmitting ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        ) : mode === "delete" ? (
          <div className="delete-confirmation">
            <p>この予定を削除しますか？</p>
            <p className="delete-confirmation-note">
              「{event.title}」は元に戻せません。
            </p>

            {errorMessage && (
              <p className="modal-error-message" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setErrorMessage("");
                  setMode("details");
                }}
              >
                キャンセル
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={isBusy}
                onClick={handleDelete}
              >
                {isSubmitting ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        ) : (
          <div className="event-details-content">
            <dl className="event-detail-list">
              <div>
                <dt>開始日時</dt>
                <dd>{formatEventDateTime(event.start_at)}</dd>
              </div>
              <div>
                <dt>終了日時</dt>
                <dd>{formatEventDateTime(event.end_at)}</dd>
              </div>
              <div>
                <dt>説明</dt>
                <dd className="event-detail-description">
                  {event.description || "未設定"}
                </dd>
              </div>
              <div>
                <dt>場所</dt>
                <dd className="event-place-detail">
                  {googleMapsUrl ? (
                    <a
                      className="event-place-link"
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${placeLabel}をGoogle Mapsで開く（新しいタブ）`}
                    >
                      {placeLabel} <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    placeLabel
                  )}
                  {event.destination &&
                    event.destination !== placeLabel && (
                      <span className="event-place-address">
                        {event.destination}
                      </span>
                    )}
                </dd>
              </div>
              <div>
                <dt>到着余裕時間</dt>
                <dd>
                  {event.arrival_buffer_minutes === null ||
                  event.arrival_buffer_minutes === undefined
                    ? "未設定"
                    : `${event.arrival_buffer_minutes}分`}
                </dd>
              </div>
            </dl>

            <PreparationChecklist
              eventId={event.id}
              preparations={preparations}
              onAdd={onPreparationAdd}
              onDelete={onPreparationDelete}
              onUpdate={onPreparationUpdate}
            />

            {isJourneyLoading ? (
              <section className="travel-plan-section">
                <h3>移動予定</h3>
                <p className="travel-plan-empty">読み込み中...</p>
              </section>
            ) : (
              <>
                {journeyNeedsReplan && (
                  <p className="journey-replan-warning" role="status">
                    予定の目的地または到着期限が変更されています。移動を再計画してください。
                  </p>
                )}
                <JourneyDetails
                  journey={journey}
                  emptyMessage={canSearchRoute ? "移動予定がありません" : "経路検索には予定の目的地が必要です"}
                  isSearchDisabled={!canSearchRoute}
                  onPlan={() => {
                    setErrorMessage("");
                    setMode("route");
                  }}
                />
              </>
            )}

            {errorMessage && (
              <p className="modal-error-message" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="modal-actions event-details-actions">
              <button
                className="danger-secondary-button"
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  setMode("delete");
                }}
              >
                削除
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={startEditing}
              >
                編集
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default EventDetailsModal;
