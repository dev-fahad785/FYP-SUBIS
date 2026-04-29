export default function AlarmPopup({ open, busName, stopName, etaText, onStopAlarm }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alarm-popup-title"
        className="w-full max-w-md rounded-xl bg-slate-900/95 ring-1 ring-white/5 shadow-2xl p-6 text-slate-100 grid gap-3"
      >
        <p className="text-xs uppercase tracking-wider text-amber-300 font-semibold">Alarm ringing</p>
        <h3 id="alarm-popup-title" className="text-lg font-bold leading-snug">
          Bus is about to reach {stopName}
        </h3>
        <p className="text-sm text-slate-300">
          {busName} will reach <strong className="text-slate-100">{stopName}</strong> in{' '}
          <strong className="text-slate-100">{etaText}</strong>.
        </p>
        <div className="mt-2">
          <button
            type="button"
            onClick={onStopAlarm}
            className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md border border-white/10 bg-transparent text-slate-100 hover:bg-white/5 transition"
          >
            Stop alarm
          </button>
        </div>
      </div>
    </div>
  );
}