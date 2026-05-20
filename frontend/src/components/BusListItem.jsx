import React from "react";
export default function BusListItem({
  bus,
  isSelected,
  etaMinutes,
  searchStartStop,
  armed,
  alarming,
  onSelect,
  onToggleArm,
  onStopAlarm,
  getBusId,
}) {
  const busId = getBusId(bus);

  return (
    <div
      className={`cursor-pointer rounded-[22px] border p-4 transition-all ${
        isSelected
          ? 'border-cyan-300/40 bg-cyan-300/10 shadow-[0_10px_24px_rgba(34,211,238,0.08)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
      }`}
      onClick={onSelect}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <strong className="text-sm text-white">{bus.plateNumber || busId}</strong>
          <div className="mt-1 text-xs text-slate-400">
            {bus.currentStop || bus.nextStop || 'Bus is in motion'}
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            bus.routeColor
              ? { backgroundColor: `${bus.routeColor}26`, color: bus.routeColor, border: `1px solid ${bus.routeColor}40` }
              : { backgroundColor: 'rgb(30 58 138 / 0.4)', color: '#93c5fd', border: '1px solid rgb(59 130 246 / 0.3)' }
          }
        >
          {bus.routeName}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-white/8 bg-[#09131d] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">ETA</div>
          <div className={`mt-1 font-semibold ${etaMinutes !== null ? 'text-white' : 'text-slate-400'}`}>
            {etaMinutes !== null ? `${etaMinutes} min` : 'Unavailable'}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            to {searchStartStop || 'start stop'}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-[#09131d] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Speed</div>
          <div className="mt-1 font-semibold text-white">{Math.round(bus.speed || 0)} km/h</div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">
            {bus.nextStop ? `Next ${bus.nextStop}` : 'Awaiting stop data'}
          </div>
        </div>
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`flex-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${
            armed
              ? 'bg-red-500 text-white hover:bg-red-400'
              : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
          }`}
          onClick={onToggleArm}
        >
          {armed ? 'Alert armed' : 'Set alert'}
        </button>
        {alarming && (
          <button
            type="button"
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
            onClick={onStopAlarm}
          >
            Stop alarm
          </button>
        )}
      </div>
    </div>
  );
}
