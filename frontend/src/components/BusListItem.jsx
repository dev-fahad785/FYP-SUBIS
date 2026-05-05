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
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-950/30'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <strong className="text-white text-sm">{bus.plateNumber || busId}</strong>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={
            bus.routeColor
              ? { backgroundColor: `${bus.routeColor}26`, color: bus.routeColor, border: `1px solid ${bus.routeColor}40` }
              : { backgroundColor: 'rgb(30 58 138 / 0.4)', color: '#93c5fd', border: '1px solid rgb(59 130 246 / 0.3)' }
          }
        >
          {bus.routeName}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-400 mb-2.5">
        {bus.currentStop && (
          <div className="flex items-center gap-1">
            <span>📍</span>
            <span>{bus.currentStop}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span>⏱</span>
          <span>
            ETA to {searchStartStop || 'start stop'}:{' '}
            <span className={etaMinutes !== null ? 'text-white font-medium' : ''}>
              {etaMinutes !== null ? `${etaMinutes} min` : 'Not available'}
            </span>
          </span>
        </div>
        {bus.speed && (
          <div className="flex items-center gap-1">
            <span>⚡</span>
            <span>{Math.round(bus.speed)} km/h</span>
          </div>
        )}
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
            armed
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          onClick={onToggleArm}
        >
          {armed ? '🔔 Armed' : 'Set alert'}
        </button>
        {alarming && (
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium transition-colors"
            onClick={onStopAlarm}
          >
            Stop alarm
          </button>
        )}
      </div>
    </div>
  );
}
