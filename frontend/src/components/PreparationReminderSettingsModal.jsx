import { useEffect } from "react";
import useModalScrollLock from "./useModalScrollLock";

function PreparationReminderSettingsModal({
  isMobile = false,
  onChange,
  onClose,
  options,
  value,
}) {
  useModalScrollLock();
  useEffect(() => {
    function handleKeyDown(keyEvent) {
      if (keyEvent.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="notification-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-settings-heading"
      >
        <div className="modal-header">
          <div>
            <p>全予定共通</p>
            <h2 id="notification-settings-heading">準備通知の設定</h2>
          </div>
          <button
            className="modal-close-button"
            type="button"
            aria-label="閉じる"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="notification-settings-content">
          <label htmlFor="preparation-reminder-minutes">
            {isMobile ? "まもなく必要と表示する時間" : "表示を始める時間"}
          </label>
          <select
            id="preparation-reminder-minutes"
            value={value}
            onChange={(selectEvent) => onChange(Number(selectEvent.target.value))}
          >
            {options.map((option) => (
              <option value={option.minutes} key={option.minutes}>
                {option.label}
              </option>
            ))}
          </select>
          <p>
            {isMobile
              ? "未来の準備はすべて一覧に表示します。選択した時間内の予定を「まもなく必要」と強調します。"
              : "未完了の準備がある予定を、選択した時間からアプリ内に表示します。"}
          </p>
        </div>

        <div className="modal-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </section>
    </div>
  );
}

export default PreparationReminderSettingsModal;
