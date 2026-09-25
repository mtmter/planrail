import RouteDetails from "./RouteDetails";
import { formatFare } from "../routeFormatters";

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
  return <div className="route-timeline journey-timeline" aria-label="移動予定の行程">
    <div className="route-place route-origin"><span aria-hidden="true" /><strong>{sections[0].origin?.name}</strong></div>
    {sections.map((section, index) => {
      const start = section.kind === "ROUTE" ? section.route?.departure_at : section.departure_at;
      const previous = sections[index - 1];
      const previousArrival = previous?.kind === "ROUTE" ? previous.route?.arrival_at : previous?.arrival_at;
      const wait = minutesBetween(previousArrival, start);
      return <div className="journey-timeline-part" key={section.key || `${section.kind}-${index}`}>
        {wait > 0 && <div className="route-segment journey-wait"><span className="route-segment-line" aria-hidden="true" /><span>待機 {wait}分</span></div>}
        {section.kind === "ROUTE" ? section.route ? <>
          <RouteDetails route={section.route} embedded />
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
          <div className="route-place"><span aria-hidden="true" /><strong>{section.destination?.name}</strong></div>
        </div>}
      </div>;
    })}
  </div>;
}
