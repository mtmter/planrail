import { formatTime } from "../dateUtils";
import {
  formatFare,
  formatUnknownCount,
  formatUnknownMinutes,
} from "../routeFormatters";
import RouteDetails from "./RouteDetails";

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

      <RouteDetails heading="経路検索結果" route={route} />

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
