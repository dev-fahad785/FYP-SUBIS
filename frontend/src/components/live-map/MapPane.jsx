import React from 'react';
import TransitMap from '../transit-map';

export default function MapPane({
  mode,
  routes,
  buses,
  students,
  highlightedBusIds,
  onBusSelect,
}) {
  return (
    <div
      className={`relative flex-1 overflow-hidden rounded-xl border transition-colors ${
        mode === 'simulated' ? 'border-amber-800/40' : 'border-gray-700'
      }`}
    >
      {mode === 'simulated' && (
        <div
          className="absolute top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-700/50 bg-amber-950/90 px-4 py-1.5 text-xs text-amber-300 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          Simulation feed active - buses and students shown are generated sample data
        </div>
      )}

      <TransitMap
        routes={routes}
        buses={buses}
        students={students}
        onBusSelect={onBusSelect}
        highlightedBusIds={highlightedBusIds}
      />
    </div>
  );
}
