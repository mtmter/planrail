import JourneyTimeline from "./JourneyTimeline";

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
      <JourneyTimeline sections={journey.sections} />
      {onPlan && <button className="route-search-button" type="button" disabled={isSearchDisabled} onClick={onPlan}>移動を再計画</button>}
      {isSearchDisabled && <p className="route-search-guidance" role="status">経路検索するには、場所を候補から選択してください</p>}
    </section>
  );
}

export default JourneyDetails;
