import React from 'react';

export default function MapToolbar({ status, mode, onModeChange, busCount, studentCount }) {
  return (
    <div className="rounded-[26px] border border-white/12 bg-[#081521]/78 px-3 py-3 shadow-[0_14px_38px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-400/16 text-sm font-black text-cyan-100 ring-1 ring-cyan-300/20">
              S
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold leading-tight text-white">SUBIS Live Transit</h3>
              <p className="truncate text-[11px] text-slate-400">Campus buses, routes, and rider activity</p>
            </div>
          </div>
          <p className="truncate text-[11px] text-slate-300/85">{status}</p>
        </div>

        <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${
              mode === 'simulated'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            onClick={() => onModeChange('simulated')}
            aria-pressed={mode === 'simulated'}
          >
            Demo
          </button>
          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors ${
              mode === 'real'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            onClick={() => onModeChange('real')}
            aria-pressed={mode === 'real'}
          >
            Live
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div
          className={`rounded-2xl border px-3 py-2 text-center ${
            mode === 'simulated'
              ? 'border-amber-300/20 bg-amber-400/10'
              : 'border-emerald-300/20 bg-emerald-400/10'
          }`}
        >
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Mode</span>
          <strong
            className={`mt-1 block text-sm ${
              mode === 'simulated' ? 'text-amber-100' : 'text-emerald-100'
            }`}
          >
            {mode === 'simulated' ? 'Demo' : 'Real'}
          </strong>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Buses</span>
          <strong className="mt-1 block text-sm text-white">{busCount}</strong>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Students</span>
          <strong className="mt-1 block text-sm text-white">{studentCount}</strong>
        </div>
      </div>

      <div
        className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${
          mode === 'simulated'
            ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
            : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full animate-pulse ${
            mode === 'simulated' ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        />
        {mode === 'simulated' ? 'Demo buses and riders are generated' : 'Showing active live telemetry'}
      </div>
    </div>
  );
}
