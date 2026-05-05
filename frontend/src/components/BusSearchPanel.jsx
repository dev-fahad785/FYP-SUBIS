import React from 'react';
import ActiveAlertsList from './ActiveAlertsList';
import AlertFeedBanner from './AlertFeedBanner';
import BusListItem from './BusListItem';

export default function BusSearchPanel({
  searchStartStop,
  searchEndStop,
  onStartStopChange,
  onEndStopChange,
  onSearch,
  onClear,
  searchLoading,
  searchResults,
  activeAlerts,
  alertFeed,
  onClearAlert,
  selectedBusId,
  onSelectBus,
  armedBuses,
  activeAlarms,
  onToggleArm,
  onStopAlarm,
  getEtaMinutes,
  getBusId,
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto">
      <h3 className="text-white font-semibold text-sm mb-4">Search for Buses</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5" htmlFor="start-stop">
            Start Stop
          </label>
          <input
            id="start-stop"
            type="text"
            placeholder="e.g., Main Station"
            value={searchStartStop}
            onChange={(e) => onStartStopChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1.5" htmlFor="end-stop">
            End Stop
          </label>
          <input
            id="end-stop"
            type="text"
            placeholder="e.g., City Center"
            value={searchEndStop}
            onChange={(e) => onEndStopChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            onClick={onSearch}
            disabled={searchLoading}
          >
            {searchLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
          {searchResults && (
            <button
              type="button"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <ActiveAlertsList alerts={activeAlerts} onClear={onClearAlert} />
      <AlertFeedBanner alert={alertFeed[0]} />

      {searchResults && (
        <div className="mt-5">
          <p className="text-xs text-gray-500 mb-3">{searchResults.message}</p>
          {searchResults.buses.length > 0 ? (
            <div className="space-y-2">
              {searchResults.buses.map((bus) => {
                const id = getBusId(bus);
                return (
                  <BusListItem
                    key={id}
                    bus={bus}
                    isSelected={selectedBusId === id}
                    etaMinutes={getEtaMinutes(bus)}
                    searchStartStop={searchStartStop}
                    armed={Boolean(armedBuses[id])}
                    alarming={Boolean(activeAlarms[id])}
                    onSelect={() => onSelectBus(bus)}
                    onToggleArm={() => onToggleArm(bus)}
                    onStopAlarm={() => onStopAlarm(id)}
                    getBusId={getBusId}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 text-sm text-center py-6">
              No buses found for this route
            </p>
          )}
        </div>
      )}
    </div>
  );
}
