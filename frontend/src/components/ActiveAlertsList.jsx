export default function ActiveAlertsList({ alerts, onClear }) {
  if (!alerts.length) return null;

  return (
    <div className="mt-5">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Active alerts
      </h4>
      <div className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-3 bg-gray-800/70 border border-gray-700 rounded-lg"
          >
            <div className="flex items-center justify-between mb-1.5">
              <strong className="text-white text-sm">{alert.routeName}</strong>
              <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
                {alert.startStopName}
              </span>
            </div>
            <div className="text-xs text-gray-400 space-y-0.5 mb-2">
              <div>Trigger: {alert.triggerStopName}</div>
              <div>
                {alert.triggeredBusIds?.length > 0
                  ? `Triggered for ${alert.triggeredBusIds.length} bus trip(s)`
                  : 'Waiting for bus...'}
              </div>
            </div>
            <button
              type="button"
              className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
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
