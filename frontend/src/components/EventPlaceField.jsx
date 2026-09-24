import PlaceAutocompleteInput from "./PlaceAutocompleteInput";

function EventPlaceField({
  id,
  value,
  selectedPlace,
  disabled = false,
  onChange,
  onPlaceSelect,
}) {
  return (
    <div className="modal-form-field">
      <label id={`${id}-label`} htmlFor={selectedPlace ? undefined : id}>
        場所 <span>任意</span>
      </label>

      {selectedPlace ? (
        <div
          className="selected-place-card"
          role="group"
          aria-labelledby={`${id}-label`}
        >
          <span className="selected-place-icon" aria-hidden="true">
            📍
          </span>
          <div className="selected-place-info">
            <p className="selected-place-name">
              {selectedPlace.name || value}
              <span role="img" aria-label="候補から選択済み">
                ✓
              </span>
            </p>
            {selectedPlace.address && (
              <p className="selected-place-address">
                {selectedPlace.address}
              </p>
            )}
          </div>
          <button
            className="selected-place-change"
            type="button"
            disabled={disabled}
            onClick={() => onPlaceSelect(null)}
          >
            変更
          </button>
        </div>
      ) : (
        <PlaceAutocompleteInput
          id={id}
          value={value}
          placeholder="例：研究室、九州大学 伊都キャンパス"
          disabled={disabled}
          onChange={onChange}
          onPlaceSelect={onPlaceSelect}
        />
      )}
    </div>
  );
}

export default EventPlaceField;
