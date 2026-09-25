import SelectedPlaceField from "./SelectedPlaceField";

function EventPlaceField({
  id,
  value,
  selectedPlace,
  disabled = false,
  onChange,
  onPlaceSelect,
}) {
  return <SelectedPlaceField id={id} label="場所" optional value={value} selectedPlace={selectedPlace}
    disabled={disabled} onChange={onChange} onPlaceSelect={onPlaceSelect} />;
}

export default EventPlaceField;
