import PlaceAutocompleteInput from "./PlaceAutocompleteInput";

export default function SelectedPlaceField({ id, label, optional = false, value, selectedPlace, readOnly = false, disabled = false, onChange, onPlaceSelect }) {
  return <div className="modal-form-field">
    <label id={`${id}-label`} htmlFor={selectedPlace || readOnly ? undefined : id}>{label}{optional && <span>任意</span>}</label>
    {selectedPlace ? <div className="selected-place-card" role="group" aria-labelledby={`${id}-label`}>
      <span className="selected-place-icon" aria-hidden="true">📍</span>
      <div className="selected-place-info"><p className="selected-place-name">{selectedPlace.name || value}<span role="img" aria-label="候補から選択済み">✓</span></p>
        {selectedPlace.address && <p className="selected-place-address">{selectedPlace.address}</p>}</div>
      {!readOnly && <button className="selected-place-change" type="button" disabled={disabled} onClick={() => onPlaceSelect(null)}>変更</button>}
    </div> : readOnly ? <p className="route-search-guidance">未設定</p> : <PlaceAutocompleteInput id={id} value={value} placeholder={label} disabled={disabled} onChange={onChange} onPlaceSelect={onPlaceSelect} />}
  </div>;
}
