import React from "react";
const DetailRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 border-b border-white/8 py-3 last:border-0">
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
    <div className="text-right text-sm font-medium text-white">{children}</div>
  </div>
);

export default function BusDetailsPanel({
  bus,
  onClose,
  etaToStartStop,
  armedBuses,
  activeAlarms,
  onToggleArm,
  onStopAlarm,
  getBusId,
}) {
  if (!bus) return null;

  const id = getBusId(bus);
  const armed = Boolean(armedBuses[id]);
  const alarming = Boolean(activeAlarms[id]);

  const lastUpdateText = bus.lastUpdate
    ? new Date(bus.lastUpdate).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Unknown';

  return (
    <div className="mb-4 rounded-[24px] border border-white/10 bg-linear-to-br from-cyan-400/10 via-white/[0.03] to-white/[0.02] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/75">
            Selected bus
          </p>
          <h3 className="mt-1 text-base font-semibold text-white">Trip details</h3>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Close bus details"
        >
          ✕
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#09131d] px-4 py-3">
        <div>
          <strong className="block text-base text-white">{bus.plateNumber || bus.busId || bus.id}</strong>
          <span className="mt-1 block text-xs text-slate-400">
            {bus.routeName || bus.routeId || 'Unknown route'}
          </span>
        </div>
        {bus.simulated ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
            Simulated
          </span>
        ) : (
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
            Real-time
          </span>
        )}
      </div>

      <div className="rounded-[20px] border border-white/10 bg-[#09131d] px-4 py-1">
        <DetailRow label="Route">
          {bus.routeName || bus.routeId || 'Unknown route'}
        </DetailRow>

        <DetailRow label="Current stop">
          {bus.currentStop || 'Between stops'}
        </DetailRow>

        <DetailRow label="Next stop">
          {bus.nextStop || bus.nearestStop || 'Not available'}
        </DetailRow>

        <DetailRow label="ETA to start stop">
          {etaToStartStop !== null ? (
            <span className="text-blue-400">{etaToStartStop} min</span>
          ) : (
            'Not available'
          )}
        </DetailRow>

        <DetailRow label="ETA to next stop">
          {typeof bus.nextStopEtaMinutes === 'number'
            ? `${bus.nextStopEtaMinutes} min`
            : 'Not available'}
        </DetailRow>

        <DetailRow label="Speed">{Math.round(bus.speed || 0)} km/h</DetailRow>

        <DetailRow label="Last update">{lastUpdateText}</DetailRow>

        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Student alert
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 rounded-2xl px-4 py-2 text-xs font-semibold transition-colors sm:flex-none ${
                armed
                  ? 'bg-red-500 text-white hover:bg-red-400'
                  : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
              }`}
              onClick={() => onToggleArm(bus)}
            >
              {armed ? 'Alert armed' : 'Set alert'}
            </button>
            {alarming && (
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                onClick={() => onStopAlarm(id)}
              >
                Stop alarm
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
