export default function AlarmPopup({ open, busName, stopName, etaText, onStopAlarm }) {
  if (!open) {
    return null;
  }

  return (
    <div className="alarm-popup-backdrop" role="presentation">
      <div className="alarm-popup" role="alertdialog" aria-modal="true" aria-labelledby="alarm-popup-title">
        <p className="alarm-popup-eyebrow">Alarm ringing</p>
        <h3 id="alarm-popup-title">Bus is about to reach {stopName}</h3>
        <p className="alarm-popup-body">
          {busName} will reach <strong>{stopName}</strong> in <strong>{etaText}</strong>.
        </p>
        <button type="button" className="btn-secondary alarm-popup-stop-btn" onClick={onStopAlarm}>
          Stop alarm
        </button>
      </div>
    </div>
  );
}