import React from "react";
const DetailRow = ({ label, children }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
    <span className="text-xs text-gray-500">{label}</span>
    <div className="text-sm text-white font-medium text-right">{children}</div>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold text-sm">Bus Details</h3>
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-700 rounded-md transition-colors text-sm"
          onClick={onClose}
          aria-label="Close bus details"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <strong className="text-white">{bus.plateNumber || bus.busId || bus.id}</strong>
        {bus.simulated ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-700/40">
            Simulated
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
            Real-time
          </span>
        )}
      </div>

      <div>
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

        <div className="flex items-center justify-between py-2.5">
          <span className="text-xs text-gray-500">Student alert</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                armed
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              onClick={() => onToggleArm(bus)}
            >
              {armed ? '🔔 Armed' : 'Set alert'}
            </button>
            {alarming && (
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
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
