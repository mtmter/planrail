import RouteDetails from "./RouteDetails";

function JourneyDetails({ journey, emptyMessage = "移動予定がありません", isSearchDisabled = false, onPlan, replanWarning = "" }) {
  if (!journey) {
    return (
      <section className="travel-plan-section">
        <h3>移動予定</h3>
        <p className="travel-plan-empty">{emptyMessage}</p>
        {onPlan && <button className="route-search-button" type="button" disabled={isSearchDisabled} onClick={onPlan}>移動を計画</button>}
        {isSearchDisabled && <p className="route-search-guidance" role="status">経路検索するには、場所を候補から選択してください</p>}
      </section>
    );
  }
  return (
    <section className="travel-plan-section journey-details-section">
      <h3>移動予定</h3>
      {replanWarning && <p className="journey-replan-warning" role="status">{replanWarning}</p>}
      <div className="journey-detail-timeline">
        {journey.sections.map((section, index) => (
          <div className="journey-detail-section" key={`${section.kind}-${index}`}>
            {section.kind === "ROUTE" ? (
              <RouteDetails route={section.route} />
            ) : (
              <div className="journey-fixed-card">
                <strong>🔒 {section.label || "固定移動"}</strong>
                <span>{section.origin?.name} → {section.destination?.name}</span>
                <span>{section.departure_at?.slice(11, 16)} → {section.arrival_at?.slice(11, 16)}</span>
                <small>固定移動</small>
              </div>
            )}
          </div>
        ))}
      </div>
      {onPlan && <button className="route-search-button" type="button" onClick={onPlan}>移動を再計画</button>}
    </section>
  );
}

export default JourneyDetails;
