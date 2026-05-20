export default function ActiveAlertsList({ alerts, onClear }) {
  if (!alerts.length) return null;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Active alerts
      </h4>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-[20px] border border-white/10 bg-[#09131d] p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="text-white text-sm">{alert.routeName}</strong>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                {alert.startStopName}
              </span>
            </div>
            <div className="mb-3 space-y-1 text-xs text-slate-400">
              <div>Trigger: {alert.triggerStopName}</div>
              <div>
                {alert.triggeredBusIds?.length > 0
                  ? `Triggered for ${alert.triggeredBusIds.length} bus trip(s)`
                  : 'Waiting for bus...'}
              </div>
            </div>
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
              onClick={() => onClear(alert.id)}
            >
              Clear
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
