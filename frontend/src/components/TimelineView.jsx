import { useState } from "react";
import { formatTime, getDateKey, isSameDay, parseDateTime, toDateTimeInputValue } from "../dateUtils";
import { getEventArrivalDeadline, hasSearchableDestination } from "../eventJourneyTarget";
import { focusedJourney, formatRelativeTime, timelineItems, timelineJourneyName } from "../timelineModel";
import JourneyTimeline from "./JourneyTimeline";

function remainingTime(target, now) {
  const targetDate = parseDateTime(target);
  if (!targetDate) return "";
  const minutes = Math.max(0, Math.ceil((targetDate - now) / 60000));
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  return `${hours}時間${minutes % 60 ? `${minutes % 60}分` : ""}`;
}

function journeyMetrics(journey) {
  const routes = journey.sections?.filter((section) => section.kind === "ROUTE").map((section) => section.route) ?? [];
  if (!routes.length) return [];
  const metrics = [];
  if (routes.every((route) => Number.isFinite(route?.transfer_count))) {
    metrics.push(`乗換 ${routes.reduce((total, route) => total + route.transfer_count, 0)}回`);
  }
  if (routes.every((route) => Number.isFinite(route?.walk_minutes))) {
    metrics.push(`徒歩 ${routes.reduce((total, route) => total + route.walk_minutes, 0)}分`);
  }
  return metrics;
}

function EventItem({ event, selectedDate, now, preparations, hasJourney, onOpen, onPlan }) {
  const eventPreparations = preparations?.filter((item) => item.event_id === event.id);
  const deadline = getEventArrivalDeadline(event);
  const canPlan = !hasJourney && hasSearchableDestination(event) && deadline > toDateTimeInputValue(now);
  return <article className="timeline-item timeline-event">
    <p className="timeline-item-time">{formatRelativeTime(event.start_at, selectedDate)}{event.end_at && ` → ${formatRelativeTime(event.end_at, selectedDate)}`}</p>
    <button type="button" className="timeline-item-title" onClick={() => onOpen(event)}>{event.title}</button>
    {(event.location_name || event.destination) && <p className="timeline-item-place">{event.location_name || event.destination}</p>}
    {eventPreparations?.length > 0 && <p className="timeline-item-muted">準備 {eventPreparations.filter((item) => item.completed).length} / {eventPreparations.length} 完了</p>}
    {!hasJourney && <div className="timeline-event-plan">
      {canPlan ? <><span>移動予定なし</span><button type="button" className="route-search-button" onClick={() => onPlan(event)}>移動を計画</button></> :
        deadline <= toDateTimeInputValue(now) ? <span>到着期限を過ぎています</span> :
          <span>移動を計画するには、場所を候補から選択してください</span>}
    </div>}
  </article>;
}

function JourneyItem({ journey, event, selectedDate, now, autoFocus, manuallyExpanded, onToggle, onOpen, onEdit }) {
  const expanded = Boolean(autoFocus || manuallyExpanded);
  const sections = journey.sections ?? [];
  const firstPlace = sections[0]?.origin?.name;
  const lastPlace = sections[sections.length - 1]?.destination?.name || journey.target?.destination?.name;
  const duration = Math.max(0, Math.round((parseDateTime(journey.arrival_at) - parseDateTime(journey.departure_at)) / 60000));
  return <article className={`timeline-item timeline-journey${autoFocus ? " is-focused" : ""}`}>
    {autoFocus && <p className="timeline-focus-label">{autoFocus === "active" ? "移動中" : "次の移動"} · {autoFocus === "active" ? `到着予定 ${formatRelativeTime(journey.arrival_at, selectedDate)}` : `出発まで ${remainingTime(journey.departure_at, now)}`}</p>}
    {!autoFocus && <p className="timeline-item-time">{formatRelativeTime(journey.departure_at, selectedDate)} → {formatRelativeTime(journey.arrival_at, selectedDate)}</p>}
    <h3 className="timeline-journey-title">{timelineJourneyName(journey, event)}</h3>
    {!autoFocus && <>
      {event && <p className="timeline-item-muted">予定「{event.title}」の移動</p>}
      <p className="timeline-item-place">{firstPlace} → {lastPlace}</p>
      <p className="timeline-item-muted">{duration}分{journeyMetrics(journey).map((metric) => ` · ${metric}`)}</p>
    </>}
    {expanded && <div className="timeline-journey-route"><JourneyTimeline sections={sections} referenceDate={selectedDate} currentTime={autoFocus === "active" ? now : null} /></div>}
    <div className="timeline-item-actions">
      {!autoFocus && <button type="button" className="secondary-button" aria-expanded={expanded} onClick={() => onToggle(journey.id)}>{expanded ? "閉じる" : "経路を見る"}</button>}
      {expanded && <><button type="button" className="secondary-button" onClick={() => onOpen(journey)}>詳細</button>
        <button type="button" className="primary-button" onClick={() => onEdit(journey)}>移動を再計画</button></>}
    </div>
  </article>;
}

export default function TimelineView({ selectedDate, currentTime, events, journeys, preparations, onEventClick, onPlanEvent, onJourneyClick, onJourneyEdit }) {
  const [manualExpanded, setManualExpanded] = useState([]);
  const items = timelineItems(events, journeys, selectedDate);
  const focus = focusedJourney(items, selectedDate, currentTime);
  const now = toDateTimeInputValue(currentTime);
  const past = items.filter((item) => item.end_at <= now);
  const remaining = items.filter((item) => item.end_at > now);
  const isToday = isSameDay(selectedDate, currentTime);
  const eventById = new Map(events.map((event) => [event.id, event]));
  const linkedEventIds = new Set(journeys.map((journey) => journey.event_id).filter(Boolean));

  function renderItem(item) {
    return <div className={isToday && item.end_at <= now ? "timeline-past" : ""} key={`${item.itemType}-${item.id}`}>
      {item.itemType === "event" ? <EventItem event={item} selectedDate={selectedDate} now={currentTime} preparations={preparations}
        hasJourney={linkedEventIds.has(item.id)} onOpen={onEventClick} onPlan={onPlanEvent} /> :
        <JourneyItem journey={item} event={eventById.get(item.event_id)} selectedDate={selectedDate} now={currentTime}
          autoFocus={focus?.journey.id === item.id ? focus.status : null} manuallyExpanded={manualExpanded.includes(item.id)}
          onToggle={(id) => setManualExpanded((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
          onOpen={onJourneyClick} onEdit={onJourneyEdit} />}
    </div>;
  }

  return <section className="timeline-view" aria-label={`${getDateKey(selectedDate)}のTimeline`}>
    {!items.length ? <p className="timeline-empty">{isToday ? "今日はまだ予定がありません" : "この日の予定はありません"}</p> :
      isToday ? <><div className="timeline-list">{past.map(renderItem)}</div><div className="timeline-now" role="separator">現在 <time dateTime={now}>{formatTime(now)}</time></div><div className="timeline-list">{remaining.map(renderItem)}</div></> :
        <div className="timeline-list">{items.map(renderItem)}</div>}
  </section>;
}
