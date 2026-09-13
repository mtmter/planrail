import { formatFare } from "../routeFormatters";
import RouteDetails from "./RouteDetails";

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

  const routeMetrics = [
    travelPlan.transfer_count !== null && travelPlan.transfer_count !== undefined
      ? `乗換 ${travelPlan.transfer_count}回`
      : null,
    travelPlan.walk_minutes !== null && travelPlan.walk_minutes !== undefined
      ? `徒歩 ${travelPlan.walk_minutes}分`
      : null,
    travelPlan.wait_minutes !== null && travelPlan.wait_minutes !== undefined
      ? `待ち時間 ${travelPlan.wait_minutes}分`
      : null,
    travelPlan.fare ? `運賃 ${formatFare(travelPlan.fare)}` : null,
  ].filter(Boolean);

  return (
    <section className="travel-plan-section">
      <h3>移動予定</h3>
      {routeMetrics.length > 0 && (
        <div
          className="travel-plan-metrics"
          role="group"
          aria-label="経路の補助情報"
        >
          {routeMetrics.join("・")}
        </div>
      )}
      <RouteDetails route={travelPlan} />

      {searchAction}
    </section>
  );
}

export default TravelPlanDetails;
