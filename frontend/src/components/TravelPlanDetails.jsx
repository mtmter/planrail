import { formatTime } from "../dateUtils";
import {
  formatFare,
  getTransitModeLabel,
} from "../routeFormatters";

function getTransportLabel(segment) {
  if (segment.type === "WALK") {
    return "徒歩";
  }

  if (segment.type === "TRANSIT") {
    return segment.line_name || getTransitModeLabel(segment.mode) || "公共交通";
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

  const segments = Array.isArray(travelPlan.segments) ? travelPlan.segments : [];
  const lastSegment = segments[segments.length - 1];
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
      <div className="travel-plan-summary">
        <strong>
          {formatTime(travelPlan.departure_at)} →{" "}
          {formatTime(travelPlan.arrival_at)}
        </strong>
        <span>所要時間 {travelPlan.duration_minutes}分</span>
        {routeMetrics.length > 0 && (
          <span className="travel-plan-metrics">{routeMetrics.join("・")}</span>
        )}
      </div>

      <div className="travel-plan-route">
        <strong>{travelPlan.origin}</strong>
        {segments.map((segment, index) => (
          <div key={`${segment.departure_at}-${index}`}>
            <span>↓ {getTransportLabel(segment)}</span>
            <strong>{segment.to}</strong>
            {(segment.train_type || segment.headsign) && (
              <span>
                {[segment.train_type, segment.headsign]
                  .filter(Boolean)
                  .join("・")}
              </span>
            )}
            {(segment.from_platform || segment.to_platform) && (
              <span>
                ホーム：{segment.from_platform || "不明"} →{" "}
                {segment.to_platform || "不明"}
              </span>
            )}
            {segment.mode && (
              <span>{getTransitModeLabel(segment.mode)}</span>
            )}
            {segment.headway_based !== null &&
              segment.headway_based !== undefined && (
              <span>
                {segment.headway_based ? "運行間隔方式" : "時刻表ベース"}
              </span>
            )}
          </div>
        ))}
        {segments.length === 0 && (
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
