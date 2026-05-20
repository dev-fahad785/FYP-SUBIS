import React from 'react';
import BusDetailsPanel from '../BusDetailsPanel';
import BusSearchPanel from '../BusSearchPanel';

export default function Sidebar({
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
  selectedBus,
  onCloseSelectedBus,
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
      <BusSearchPanel
        searchStartStop={searchStartStop}
        searchEndStop={searchEndStop}
        onStartStopChange={onStartStopChange}
        onEndStopChange={onEndStopChange}
        onSearch={onSearch}
        onClear={onClear}
        searchLoading={searchLoading}
        searchResults={searchResults}
        activeAlerts={activeAlerts}
        alertFeed={alertFeed}
        onClearAlert={onClearAlert}
        selectedBusId={selectedBusId}
        onSelectBus={onSelectBus}
        armedBuses={armedBuses}
        activeAlarms={activeAlarms}
        onToggleArm={onToggleArm}
        onStopAlarm={onStopAlarm}
        getEtaMinutes={getEtaMinutes}
        getBusId={getBusId}
      />

      {selectedBus && (
        <BusDetailsPanel
          bus={selectedBus}
          onClose={onCloseSelectedBus}
          etaToStartStop={getEtaMinutes(selectedBus)}
          armedBuses={armedBuses}
          activeAlarms={activeAlarms}
          onToggleArm={onToggleArm}
          onStopAlarm={onStopAlarm}
          getBusId={getBusId}
        />
      )}
    </div>
  );
}
