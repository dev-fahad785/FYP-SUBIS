import React from 'react';

export default function MapToolbar({ status, mode, onModeChange, busCount, studentCount }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-wrap shrink-0">
      <div className="min-w-0">
        <h3 className="text-white font-semibold text-sm leading-tight">Live bus map</h3>
        <p className="text-gray-500 text-xs truncate mt-0.5">{status}</p>
      </div>

      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          mode === 'simulated'
            ? 'bg-amber-950/60 text-amber-300 border border-amber-700/40'
            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/40'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            mode === 'simulated' ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
        />
        {mode === 'simulated' ? 'Simulation mode' : 'Real-time mode'}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
          <span className="text-gray-400 text-xs">Buses</span>
          <strong className="text-white text-sm tabular-nums">{busCount}</strong>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
          <span className="text-gray-400 text-xs">Students</span>
          <strong className="text-white text-sm tabular-nums">{studentCount}</strong>
        </div>
      </div>

      <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-auto">
        <button
          type="button"
          className={`px-4 py-1.5 text-xs font-medium transition-colors ${
            mode === 'simulated'
              ? 'bg-blue-600 text-white'
              : 'bg-transparent text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => onModeChange('simulated')}
          aria-pressed={mode === 'simulated'}
        >
          Simulated
        </button>
        <button
          type="button"
          className={`px-4 py-1.5 text-xs font-medium transition-colors border-l border-gray-700 ${
            mode === 'real'
              ? 'bg-blue-600 text-white'
              : 'bg-transparent text-gray-400 hover:text-gray-200'
          }`}
          onClick={() => onModeChange('real')}
          aria-pressed={mode === 'real'}
        >
          Real Time
        </button>
      </div>
    </div>
  );
}
