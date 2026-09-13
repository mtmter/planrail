import { formatTime } from "../dateUtils";
import {
  formatFare,
  formatUnknownCount,
  formatUnknownMinutes,
  getTransitModeLabel,
} from "../routeFormatters";

function getTransportLabel(type) {
  if (type === "WALK") {
    return "徒歩";
  }

  if (type === "TRANSIT") {
    return "公共交通";
  }

  return type;
}

function RouteSearchResult({
  activeCandidateId,
  candidates,
  errorMessage,
  isRegistering,
  onRegister,
  onRetry,
  onSelectCandidate,
  recommendedCandidateId,
  route,
  warnings = [],
}) {
  return (
    <div className="route-result">
      <section className="route-candidates" aria-label="経路候補">
        <h3>経路候補を比較</h3>
        <div className="route-candidate-list">
          {candidates.map((candidate, index) => {
            const isRecommended =
              candidate.candidate_id === recommendedCandidateId;
            const isActive = candidate.candidate_id === activeCandidateId;

            return (
              <button
                aria-pressed={isActive}
                className={`route-candidate-card${isActive ? " is-active" : ""}`}
                disabled={isRegistering}
                key={candidate.candidate_id}
                type="button"
                onClick={() => onSelectCandidate(candidate.candidate_id)}
              >
                <span className="route-candidate-heading">
                  <strong>候補 {index + 1}</strong>
                  {isRecommended && (
                    <span className="route-recommended-badge">おすすめ</span>
                  )}
                </span>
                <span className="route-candidate-times">
                  {formatTime(candidate.departure_at)}発 →{" "}
                  {formatTime(candidate.arrival_at)}着
                </span>
                <span>{candidate.duration_minutes}分</span>
                <span>乗換 {formatUnknownCount(candidate.transfer_count)}</span>
                <span>徒歩 {formatUnknownMinutes(candidate.walk_minutes)}</span>
                <span>運賃 {formatFare(candidate.fare)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {warnings.length > 0 && (
        <ul className="route-search-warnings" aria-label="経路検索に関する注意" role="status">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${index}`}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="route-result-heading">
        <h3>経路検索結果</h3>
        <div className="route-result-times" aria-label="経路全体の所要時間">
          <div>
            <strong>{formatTime(route.departure_at)}</strong>
            <span>出発</span>
          </div>
          <p>{route.duration_minutes}分</p>
          <div>
            <strong>{formatTime(route.arrival_at)}</strong>
            <span>到着</span>
          </div>
        </div>
      </div>

      <div className="route-timeline">
        <div className="route-place route-origin">
          <span aria-hidden="true" />
          <strong>{route.origin}</strong>
        </div>

        {route.segments.map((segment, index) => (
          <div
            className="route-segment-group"
            key={`${segment.departure_at}-${index}`}
          >
            <div className="route-segment">
              <span className="route-segment-line" aria-hidden="true" />
              <div className="route-segment-details">
                <strong>
                  {segment.type === "TRANSIT" && segment.line_name
                    ? segment.line_name
                    : getTransportLabel(segment.type)}
                </strong>
                <span>
                  {getTransportLabel(segment.type)}・{segment.duration_minutes}分
                </span>
                <span>
                  {segment.from} → {segment.to}
                </span>
                <span>
                  {formatTime(segment.departure_at)} →{" "}
                  {formatTime(segment.arrival_at)}
                </span>
                {segment.mode && (
                  <span>{getTransitModeLabel(segment.mode)}</span>
                )}
                {segment.train_type && <span>列車種別：{segment.train_type}</span>}
                {segment.headsign && <span>行先：{segment.headsign}</span>}
                {(segment.from_platform || segment.to_platform) && (
                  <span>
                    ホーム：{segment.from_platform || "不明"} →{" "}
                    {segment.to_platform || "不明"}
                  </span>
                )}
                {segment.headway_based !== null &&
                  segment.headway_based !== undefined && (
                  <span>
                    {segment.headway_based ? "運行間隔方式" : "時刻表ベース"}
                  </span>
                )}
              </div>
            </div>

            <div className="route-place">
              <span aria-hidden="true" />
              <strong>{segment.to}</strong>
            </div>
          </div>
        ))}

        <p className="route-destination-label">目的地：{route.destination}</p>
      </div>

      {errorMessage && (
        <p className="modal-error-message" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="modal-actions route-result-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={isRegistering}
          onClick={onRetry}
        >
          検索条件を変更
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={isRegistering}
          onClick={() => onRegister?.(route)}
        >
          {isRegistering ? "保存中..." : "この経路を登録"}
        </button>
      </div>
    </div>
  );
}

export default RouteSearchResult;
