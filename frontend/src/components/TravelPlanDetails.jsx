import { formatTime } from "../dateUtils";
import { getPlaceLabel } from "../travelUtils";

function TravelPlanDetails({
  travelBlocks,
  onSearchInbound,
  onSearchOutbound,
  onSelect,
  requiresPlaceReselection = false,
}) {
  return (
    <section className="travel-plan-section">
      <h3>移動予定</h3>
      {travelBlocks.length === 0 ? (
        <p className="travel-plan-empty">移動予定がありません</p>
      ) : (
        <div className="event-travel-block-list">
          {travelBlocks.map((block) => (
            <button
              className={`event-travel-block${block.needs_review ? " needs-review" : ""}`}
              type="button"
              key={block.id}
              onClick={() => onSelect(block)}
            >
              <strong>
                {formatTime(block.start_at)} → {formatTime(block.end_at)}
              </strong>
              <span>
                {getPlaceLabel(block.origin)} → {getPlaceLabel(block.destination)}
              </span>
              {block.needs_review && <small>要確認</small>}
            </button>
          ))}
        </div>
      )}
      <div className="travel-plan-actions">
        <button className="route-search-button" type="button" onClick={onSearchInbound}>
          行きの経路を検索
        </button>
        <button className="route-search-button" type="button" onClick={onSearchOutbound}>
          帰りの経路を検索
        </button>
      </div>
      {requiresPlaceReselection && (
        <p className="travel-plan-empty">
          再検索時に予定の場所をPlaces候補から選択してください。
        </p>
      )}
    </section>
  );
}

export default TravelPlanDetails;
