import RouteDetails, { RoutePlace, RouteTimeSummary } from "./RouteDetails";
import { formatFare } from "../routeFormatters";

function sectionDepartureAt(section) {
  return section?.kind === "ROUTE" ? section.route?.departure_at : section?.departure_at;
}

function sectionArrivalAt(section) {
  return section?.kind === "ROUTE" ? section.route?.arrival_at : section?.arrival_at;
}

function minutesBetween(first, second) {
  if (!first || !second) return 0;
  const start = Date.parse(`${first}:00Z`);
  const end = Date.parse(`${second}:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 60000)) : 0;
}

function candidateMetrics(route) {
  return [
    route?.duration_minutes != null && `${route.duration_minutes}分`,
    route?.transfer_count != null && `乗換 ${route.transfer_count}回`,
    route?.walk_minutes != null && `徒歩 ${route.walk_minutes}分`,
    route?.wait_minutes != null && `待ち時間 ${route.wait_minutes}分`,
    route?.fare && `運賃 ${formatFare(route.fare)}`,
  ].filter(Boolean).join("・");
}

export default function JourneyTimeline({ sections, onCandidateChange, candidateDisabled = false }) {
  if (!sections?.length) return null;
  const departureAt = sectionDepartureAt(sections[0]);
  const arrivalAt = sectionArrivalAt(sections[sections.length - 1]);
  const originName = sections[0].origin?.name;
  const destinationName = sections[sections.length - 1].destination?.name;
  return <div className="route-timeline journey-timeline" aria-label="移動予定の行程">
    {departureAt && arrivalAt && <RouteTimeSummary
      departureAt={departureAt}
      arrivalAt={arrivalAt}
      durationMinutes={minutesBetween(departureAt, arrivalAt)}
      heading={originName && destinationName ? `${originName} → ${destinationName}` : null}
      className="journey-result-heading"
      ariaLabel="移動予定全体の出発時刻、到着時刻、所要時間"
    />}
    <RoutePlace name={sections[0].origin?.name} departureAt={departureAt} origin />
    {sections.map((section, index) => {
      const start = sectionDepartureAt(section);
      const previous = sections[index - 1];
      const previousArrival = sectionArrivalAt(previous);
      const nextDepartureAt = sectionDepartureAt(sections[index + 1]);
      const wait = minutesBetween(previousArrival, start);
      return <div className="journey-timeline-part" key={section.key || `${section.kind}-${index}`}>
        {wait > 0 && <div className="route-segment journey-wait"><span className="route-segment-line" aria-hidden="true" /><span>待機 {wait}分</span></div>}
        {section.kind === "ROUTE" ? section.route ? <>
          <RouteDetails route={section.route} embedded nextDepartureAt={nextDepartureAt} />
          {candidateMetrics(section.route) && <p className="journey-route-metrics">{candidateMetrics(section.route)}</p>}
          {(section.warnings || []).map((warning, at) => <p className="route-search-guidance" key={at}>{warning}</p>)}
          {onCandidateChange && section.candidates?.length > 0 && <details className="journey-candidate-picker">
            <summary>別の候補を見る</summary>
            <div className="route-candidate-list" aria-label="経路候補">{section.candidates.map((candidate, at) =>
              <button type="button" key={candidate.candidate_id} disabled={candidateDisabled} className={`route-candidate-card${section.route?.candidate_id === candidate.candidate_id ? " is-active" : ""}`}
                aria-pressed={section.route?.candidate_id === candidate.candidate_id} onClick={() => onCandidateChange(section.key, candidate.candidate_id)}>
                <span className="route-candidate-heading"><strong>候補 {at + 1}</strong>{candidate.candidate_id === section.recommendedId && <span className="route-recommended-badge">おすすめ</span>}</span>
                <span>{candidate.departure_at?.replace("T", " ")} → {candidate.arrival_at?.replace("T", " ")}</span>
                <span>{candidateMetrics(candidate)}</span>
              </button>)}</div>
          </details>}
        </> : <div className="route-segment journey-missing"><span className="route-segment-line" aria-hidden="true" />
          <p>{section.origin?.name} → {section.destination?.name}: {section.error || "経路を検索できませんでした"}</p></div>
        : <div className="route-segment-group">
          <div className="route-segment"><span className="route-segment-line" aria-hidden="true" />
            <div className="route-segment-details"><strong>🔒 {section.label || "固定移動"}</strong>
              <span>{section.origin?.name} → {section.destination?.name}</span>
              <span>{section.departure_at?.replace("T", " ")} → {section.arrival_at?.replace("T", " ")}</span></div></div>
          <RoutePlace name={section.destination?.name} arrivalAt={section.arrival_at} departureAt={nextDepartureAt} />
        </div>}
      </div>;
    })}
  </div>;
}
