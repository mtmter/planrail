import { useEffect, useState } from "react";
import {
  WEEKDAY_NAMES,
  eventOccursOnDate,
  formatTime,
  getDateKey,
  getEventDaySegment,
  getMonthDates,
  isSameDay,
  parseDateTime,
} from "../dateUtils";

const MAX_ITEMS_WITHOUT_SUMMARY_IN_FIVE_WEEK_MONTH = 4;
const VISIBLE_ITEMS_WITH_SUMMARY_IN_FIVE_WEEK_MONTH = 3;
const MAX_ITEMS_WITHOUT_SUMMARY_IN_SIX_WEEK_MONTH = 3;
const VISIBLE_ITEMS_WITH_SUMMARY_IN_SIX_WEEK_MONTH = 2;

function MonthCalendar({
  events,
  selectedDate,
  onDateClick,
  onEventClick,
}) {
  const calendarDates = getMonthDates(selectedDate);
  const hasSixWeeks = calendarDates.length === 42;
  const [dayEventsPopup, setDayEventsPopup] = useState(null);
  const today = new Date();

  useEffect(() => {
    if (!dayEventsPopup) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setDayEventsPopup(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dayEventsPopup]);

  return (
    <section aria-label="月間カレンダー">
      <div className="calendar-horizontal-scroll">
        <div
          className={`month-calendar${hasSixWeeks ? " has-six-weeks" : ""}`}
        >
          <div className="month-weekdays" aria-hidden="true">
            {WEEKDAY_NAMES.map((weekday, index) => (
              <div
                className={
                  index === 0
                    ? "is-sunday"
                    : index === 6
                      ? "is-saturday"
                      : ""
                }
                key={weekday}
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="month-grid">
            {calendarDates.map((date) => {
              const dateEvents = events
                .filter((event) => eventOccursOnDate(event, date))
                .sort((firstEvent, secondEvent) =>
                  (firstEvent.start_at ?? "").localeCompare(
                    secondEvent.start_at ?? "",
                  ),
                );
              const maxItemsWithoutSummary = hasSixWeeks
                ? MAX_ITEMS_WITHOUT_SUMMARY_IN_SIX_WEEK_MONTH
                : MAX_ITEMS_WITHOUT_SUMMARY_IN_FIVE_WEEK_MONTH;
              const visibleItemsWithSummary = hasSixWeeks
                ? VISIBLE_ITEMS_WITH_SUMMARY_IN_SIX_WEEK_MONTH
                : VISIBLE_ITEMS_WITH_SUMMARY_IN_FIVE_WEEK_MONTH;
              const visibleEventCount =
                dateEvents.length > maxItemsWithoutSummary
                  ? visibleItemsWithSummary
                  : dateEvents.length;
              const visibleEvents = dateEvents.slice(0, visibleEventCount);
              const hiddenEventCount = dateEvents.length - visibleEvents.length;
              const isOutsideMonth =
                date.getMonth() !== selectedDate.getMonth();

              return (
                <div
                  className={`month-day${isOutsideMonth ? " is-outside-month" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日に追加`}
                  key={getDateKey(date)}
                  onClick={() => onDateClick(date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onDateClick(date);
                    }
                  }}
                >
                  <time
                    className={`month-date${isSameDay(date, today) ? " is-today" : ""}`}
                    dateTime={getDateKey(date)}
                  >
                    {date.getDate()}
                  </time>

                  <div className="month-day-items">
                    {visibleEvents.map((event) => {
                      const segment = getEventDaySegment(event, date);
                      const eventStart = parseDateTime(event.start_at);
                      const showStartTime =
                        eventStart && isSameDay(eventStart, date);
                      const connectsFromPreviousDay =
                        segment.continuesBefore && date.getDay() !== 0;
                      const connectsToNextDay =
                        segment.continuesAfter && date.getDay() !== 6;

                      return (
                        <div
                          className={`month-event${event.itemType === "journey" ? " is-journey" : ""}${connectsFromPreviousDay ? " continues-before" : ""}${connectsToNextDay ? " continues-after" : ""}`}
                          title={event.title}
                          key={`event-${event.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onEventClick(event);
                          }}
                          onKeyDown={(keyEvent) => {
                            if (
                              keyEvent.key === "Enter" ||
                              keyEvent.key === " "
                            ) {
                              keyEvent.preventDefault();
                              keyEvent.stopPropagation();
                              onEventClick(event);
                            }
                          }}
                        >
                          {showStartTime && (
                            <span className="month-item-time">
                              {formatTime(event.start_at)}
                            </span>
                          )}
                          <span>{event.title}</span>
                        </div>
                      );
                    })}

                    {hiddenEventCount > 0 && (
                      <button
                        type="button"
                        className="month-more-events"
                        title={`他${hiddenEventCount}件の予定を表示`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setDayEventsPopup({
                            date,
                            events: dateEvents,
                          });
                        }}
                        onKeyDown={(keyEvent) => keyEvent.stopPropagation()}
                      >
                        他{hiddenEventCount}件
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {dayEventsPopup && (
        <div
          className="month-events-popover-backdrop"
          onClick={() => setDayEventsPopup(null)}
        >
          <section
            aria-labelledby={`month-events-title-${getDateKey(dayEventsPopup.date)}`}
            aria-modal="true"
            className="month-events-popover"
            role="dialog"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <header className="month-events-popover-header">
              <span aria-hidden="true" />
              <div>
                <span>{WEEKDAY_NAMES[dayEventsPopup.date.getDay()]}</span>
                <time
                  dateTime={getDateKey(dayEventsPopup.date)}
                  id={`month-events-title-${getDateKey(dayEventsPopup.date)}`}
                >
                  {dayEventsPopup.date.getDate()}
                </time>
              </div>
              <button
                autoFocus
                aria-label="予定の一覧を閉じる"
                className="modal-close-button"
                type="button"
                onClick={() => setDayEventsPopup(null)}
              >
                ×
              </button>
            </header>

            <div className="month-events-popover-list">
              {dayEventsPopup.events.map((event) => {
                const eventStart = parseDateTime(event.start_at);
                const showStartTime =
                  eventStart && isSameDay(eventStart, dayEventsPopup.date);

                return (
                  <button
                    type="button"
                    className={`month-events-popover-event${event.itemType === "journey" ? " is-journey" : ""}`}
                    key={`popup-event-${event.id}`}
                    title={event.title}
                    onClick={() => {
                      setDayEventsPopup(null);
                      onEventClick(event);
                    }}
                  >
                    {showStartTime && (
                      <span className="month-item-time">
                        {formatTime(event.start_at)}
                      </span>
                    )}
                    <span>{event.title}</span>
                  </button>
                );
              })}

            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default MonthCalendar;
