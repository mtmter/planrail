import {
  WEEKDAY_NAMES,
  getDateKey,
  getMonthDates,
  isSameDay,
} from "../dateUtils";
import { getMobileCalendarDay } from "../mobileScheduleModel";

function MobileMonthCalendar({ items, selectedDate, onDateSelect }) {
  const today = new Date();

  return (
    <section className="mobile-month-calendar" aria-label="月間カレンダー">
      <div className="mobile-month-weekdays" aria-hidden="true">
        {WEEKDAY_NAMES.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div className="mobile-month-grid">
        {getMonthDates(selectedDate).map((date) => {
          const day = getMobileCalendarDay(items, date);
          const dateKey = getDateKey(date);
          const isOutsideMonth = date.getMonth() !== selectedDate.getMonth();
          const itemDescription = day.items
            .map((item) => `${item.itemType === "journey" ? "移動予定" : "予定"}: ${item.title}`)
            .join("、");

          return (
            <button
              type="button"
              className={`mobile-month-day${isOutsideMonth ? " is-outside-month" : ""}${isSameDay(date, today) ? " is-today" : ""}${isSameDay(date, selectedDate) ? " is-selected" : ""}`}
              key={dateKey}
              aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${itemDescription ? `、${itemDescription}` : "、予定なし"}。タイムラインを見る`}
              aria-current={isSameDay(date, today) ? "date" : undefined}
              onClick={() => onDateSelect(date)}
            >
              <time dateTime={dateKey} className="mobile-month-date">
                {date.getDate()}
              </time>
              <span className="mobile-month-type-cues" aria-hidden="true">
                {day.hasEvent && <span className="mobile-month-type-cue is-event" />}
                {day.hasJourney && <span className="mobile-month-type-cue is-journey" />}
              </span>
              {day.items.length > 0 && (
                <span className={`mobile-month-title${day.items[0].itemType === "journey" ? " is-journey" : ""}`}>
                  {day.items[0].title}
                </span>
              )}
              {day.hiddenCount > 0 && (
                <span className="mobile-month-more">+{day.hiddenCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default MobileMonthCalendar;
