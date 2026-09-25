import {
  WEEKDAY_NAMES,
  eventOccursOnDate,
  getDateKey,
  getEventPositionForDay,
  isSameDay,
} from "../dateUtils";

const HOUR_HEIGHT = 56;

function formatMinutes(minutes) {
  if (minutes === 24 * 60) {
    return "24:00";
  }

  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function layoutOverlappingEvents(events, date) {
  const positioned = events
    .map((event) => ({
      event,
      position: getEventPositionForDay(event, date),
    }))
    .sort((first, second) => first.position.startMinutes - second.position.startMinutes);
  const laidOut = [];
  let cluster = [];
  let clusterEnd = -1;

  function flushCluster() {
    if (!cluster.length) return;
    const laneEnds = [];
    cluster.forEach((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.position.startMinutes);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.position.startMinutes + item.position.durationMinutes;
      laidOut.push({ ...item, lane, laneCount: 0 });
    });
    laidOut.slice(-cluster.length).forEach((item) => {
      item.laneCount = laneEnds.length;
    });
    cluster = [];
  }

  positioned.forEach((item) => {
    if (cluster.length && item.position.startMinutes >= clusterEnd) {
      flushCluster();
    }
    cluster.push(item);
    clusterEnd = Math.max(
      clusterEnd,
      item.position.startMinutes + item.position.durationMinutes,
    );
  });
  flushCluster();
  return laidOut;
}

function DayCalendar({
  events,
  selectedDate,
  onEventClick,
  onTimeClick,
}) {
  const today = new Date();
  const weekdayIndex = selectedDate.getDay();
  const dateEvents = events
    .filter((event) => eventOccursOnDate(event, selectedDate))
    .sort((firstEvent, secondEvent) =>
      (firstEvent.start_at ?? "").localeCompare(secondEvent.start_at ?? ""),
    );
  return (
    <section aria-label="日間カレンダー">
      <div className="calendar-horizontal-scroll">
        <div className="day-calendar">
          <div className="week-header-row day-header-row">
            <div className="week-corner" />
            <div className="week-date-heading">
              <span
                className={
                  weekdayIndex === 0
                    ? "is-sunday"
                    : weekdayIndex === 6
                      ? "is-saturday"
                      : ""
                }
              >
                {WEEKDAY_NAMES[weekdayIndex]}
              </span>
              <time
                className={isSameDay(selectedDate, today) ? "is-today" : ""}
                dateTime={getDateKey(selectedDate)}
              >
                {selectedDate.getDate()}
              </time>
            </div>
          </div>

          <div className="week-time-scroll">
            <div
              className="week-time-grid day-time-grid"
              style={{ height: `${24 * HOUR_HEIGHT}px` }}
            >
              <div className="week-hours" aria-hidden="true">
                {Array.from({ length: 24 }, (_, hour) => (
                  <span
                    style={{ top: `${hour * HOUR_HEIGHT}px` }}
                    key={hour}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              <div
                className="week-day-column"
                style={{ "--hour-height": `${HOUR_HEIGHT}px` }}
                onClick={(event) => {
                  const columnRectangle =
                    event.currentTarget.getBoundingClientRect();
                  const clickedMinutes =
                    ((event.clientY - columnRectangle.top) / HOUR_HEIGHT) * 60;
                  const roundedMinutes = Math.min(
                    Math.max(Math.floor(clickedMinutes / 30) * 30, 0),
                    23 * 60 + 30,
                  );
                  onTimeClick(selectedDate, roundedMinutes);
                }}
              >
                {layoutOverlappingEvents(dateEvents, selectedDate).map(({ event, position, lane, laneCount }) => {

                  return (
                    <div
                      className={`week-event${event.itemType === "journey" ? " is-journey" : ""}`}
                      style={{
                        top: `${(position.startMinutes / 60) * HOUR_HEIGHT}px`,
                        height: `${Math.max(
                          (position.durationMinutes / 60) * HOUR_HEIGHT,
                          28,
                        )}px`,
                        left: `calc(${(lane * 100) / laneCount}% + 4px)`,
                        right: "auto",
                        width: `calc(${100 / laneCount}% - 8px)`,
                      }}
                      title={event.title}
                      key={event.id}
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
                      <strong>{event.title}</strong>
                      <span>
                        {formatMinutes(position.startMinutes)}–
                        {formatMinutes(
                          position.startMinutes + position.durationMinutes,
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DayCalendar;
