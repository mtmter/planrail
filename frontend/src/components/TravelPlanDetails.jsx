import { formatTime } from "../dateUtils";

function getTransportLabel(segment) {
  if (segment.type === "WALK") {
    return "徒歩";
  }

  if (segment.type === "TRANSIT") {
    return segment.line_name || "公共交通";
  }

  return segment.type;
}

function TravelPlanDetails({
  emptyMessage = "移動予定がありません",
  isSearchDisabled = false,
  onSearch,
  travelPlan,
}) {
  const searchAction = onSearch && (
    <>
      <button
        className="route-search-button"
        type="button"
        disabled={isSearchDisabled}
        onClick={onSearch}
      >
        {travelPlan ? "経路を再検索" : "経路を検索"}
      </button>
      {isSearchDisabled && (
        <p className="route-search-guidance" role="status">
          経路検索するには、場所を候補から選択してください
        </p>
      )}
    </>
  );

  if (!travelPlan) {
    return (
      <section className="travel-plan-section">
        <h3>移動予定</h3>
        <p className="travel-plan-empty">{emptyMessage}</p>
        {searchAction}
      </section>
    );
  }

  const lastSegment =
    travelPlan.segments[travelPlan.segments.length - 1];

  return (
    <section className="travel-plan-section">
      <h3>移動予定</h3>
      <div className="travel-plan-summary">
        <strong>
          {formatTime(travelPlan.departure_at)} →{" "}
          {formatTime(travelPlan.arrival_at)}
        </strong>
        <span>所要時間 {travelPlan.duration_minutes}分</span>
      </div>

      <div className="travel-plan-route">
        <strong>{travelPlan.origin}</strong>
        {travelPlan.segments.map((segment, index) => (
          <div key={`${segment.departure_at}-${index}`}>
            <span>↓ {getTransportLabel(segment)}</span>
            <strong>{segment.to}</strong>
          </div>
        ))}
        {travelPlan.segments.length === 0 && (
          <div>
            <span>↓ {travelPlan.transport_mode}</span>
            <strong>{travelPlan.destination}</strong>
          </div>
        )}
        {lastSegment && lastSegment.to !== travelPlan.destination && (
          <div>
            <span aria-hidden="true">↓</span>
            <strong>{travelPlan.destination}</strong>
          </div>
        )}
      </div>

      {searchAction}
    </section>
  );
}

export default TravelPlanDetails;
