import { useState } from "react";
import { WEEKDAY_NAMES, formatTime } from "../dateUtils";

function MobilePreparationPage({ groups, onEventClick, onRetry, onUpdate }) {
  const [busyId, setBusyId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleComplete(group, preparation) {
    if (busyId) {
      return;
    }

    setBusyId(preparation.id);
    setErrorMessage("");
    try {
      await onUpdate(group.event.id, preparation.id, {
        title: preparation.title,
        completed: true,
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setBusyId(null);
    }
  }

  if (groups === null) {
    return (
      <div className="mobile-preparation-error" role="alert">
        <p>準備項目を読み込めませんでした。</p>
        <button type="button" onClick={onRetry}>再読み込み</button>
      </div>
    );
  }

  return (
    <section className="mobile-preparation-page" aria-label="未来の予定の準備">
      {errorMessage && <p className="mobile-preparation-action-error" role="alert">{errorMessage}</p>}
      {groups.length === 0 ? (
        <p className="empty-message">未来の予定に未完了の準備はありません</p>
      ) : (
        <div className="mobile-preparation-groups">
          {groups.map((group) => {
            const date = group.eventStart;
            const dateLabel = `${date.getMonth() + 1}/${date.getDate()}（${WEEKDAY_NAMES[date.getDay()]}） ${formatTime(group.event.start_at)}`;

            return (
              <section className={`mobile-preparation-group${group.isSoon ? " is-soon" : ""}`} key={group.event.id}>
                {group.isSoon && <p className="mobile-preparation-soon">まもなく必要</p>}
                <time dateTime={group.event.start_at} className="mobile-preparation-time">{dateLabel}</time>
                <button
                  className="mobile-preparation-event"
                  type="button"
                  onClick={() => onEventClick(group.event)}
                >
                  {group.event.title}
                </button>
                <ul className="mobile-preparation-items">
                  {group.items.map((preparation) => (
                    <li key={preparation.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={Boolean(busyId)}
                          onChange={() => handleComplete(group, preparation)}
                        />
                        <span>{preparation.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default MobilePreparationPage;
