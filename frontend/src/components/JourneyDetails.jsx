import RouteDetails from "./RouteDetails";

function waitMinutes(previous, current) {
  if (!previous) return 0;
  const previousArrival = previous.kind === "ROUTE" ? previous.route?.arrival_at : previous.arrival_at;
  const currentDeparture = current.kind === "ROUTE" ? current.route?.departure_at : current.departure_at;
  const minutes = (value) => {
    const parts = typeof value === "string" ? value.match(/\d+/g) : null;
    if (parts?.length !== 5) return null;
    const [year, month, day, hour, minute] = parts.map(Number);
    return Date.UTC(year, month - 1, day, hour, minute) / 60000;
  };
  const departure = minutes(currentDeparture);
  const arrival = minutes(previousArrival);
  return departure === null || arrival === null ? 0 : departure - arrival;
}

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
            {waitMinutes(journey.sections[index - 1], section) > 0 &&
              <div className="journey-wait-time">待機 {waitMinutes(journey.sections[index - 1], section)}分</div>}
            {section.kind === "ROUTE" ? (
              <RouteDetails route={section.route} />
            ) : (
              <div className="journey-fixed-card">
                <strong>🔒 {section.label || "固定移動"}</strong>
                <span>{section.origin?.name} → {section.destination?.name}</span>
                <span>{section.departure_at?.replace("T", " ")} → {section.arrival_at?.replace("T", " ")}</span>
                <small>固定移動</small>
              </div>
            )}
          </div>
        ))}
      </div>
      {onPlan && <button className="route-search-button" type="button" disabled={isSearchDisabled} onClick={onPlan}>移動を再計画</button>}
      {isSearchDisabled && <p className="route-search-guidance" role="status">経路検索するには、場所を候補から選択してください</p>}
    </section>
  );
}

export default JourneyDetails;
