function AddChoiceModal({ onChooseEvent, onChooseJourney, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="event-details-modal add-choice-modal" role="dialog" aria-modal="true">
        <div className="modal-header"><div><p>新しく追加</p><h2>追加するものを選択</h2></div><button className="modal-close-button" type="button" onClick={onClose}>×</button></div>
        <div className="modal-actions add-choice-actions">
          <button className="primary-button" type="button" onClick={onChooseEvent}>予定を追加</button>
          <button className="secondary-button" type="button" onClick={onChooseJourney}>移動予定を追加</button>
        </div>
      </section>
    </div>
  );
}

export default AddChoiceModal;
