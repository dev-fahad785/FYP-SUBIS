import React from 'react';
import { useMemo, useState } from 'react';
import AlarmPopup from '../AlarmPopup';
import MapToolbar from '../MapToolbar';
import { useSocketData } from '../../hooks/useSocketData';
import { useAlarms } from '../../hooks/useAlarms';
import MapPane from './MapPane';
import Sidebar from './Sidebar';
import { useRoutes } from './useRoutes';
import { getBusId } from './utils';

export default function LiveMap({ userId = '', userName = 'Student', onLogout }) {
  const routes = useRoutes();
  const [selectedBusId, setSelectedBusId] = useState('');
  const [mode, setMode] = useState('simulated');
  const [searchStartStop, setSearchStartStop] = useState('');
  const [searchEndStop, setSearchEndStop] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const { buses, students, activeAlerts, alertFeed, status, clearAlert } = useSocketData(
    userId,
    userName,
  );
  const { armedBuses, activeAlarms, toggleArmForBus, stopAlarm } = useAlarms(buses);

  const busList = useMemo(() => Object.values(buses), [buses]);
  const studentList = useMemo(() => Object.values(students), [students]);

  const visibleBuses = useMemo(
    () => busList.filter((bus) => (mode === 'simulated' ? bus.simulated : !bus.simulated)),
    [busList, mode],
  );
  const visibleStudents = useMemo(() => {
    const filteredStudents = studentList.filter((student) =>
      mode === 'simulated' ? student.isSimulated : !student.isSimulated,
    );

    return mode === 'simulated' ? filteredStudents.slice(0, 3) : filteredStudents;
  }, [studentList, mode]);

  const selectedBus = selectedBusId
    ? buses[selectedBusId] ??
      searchResults?.buses?.find((bus) => getBusId(bus) === selectedBusId) ??
      null
    : null;

  const getEtaMinutes = (bus) => {
    const liveBus = buses[getBusId(bus)] ?? bus;
    const normalizedStart = searchStartStop.toLowerCase().trim();
    const match = (liveBus?.etas ?? []).find(
      (eta) => eta.stopName?.toLowerCase().trim() === normalizedStart,
    );

    return typeof match?.estimatedMinutes === 'number' ? match.estimatedMinutes : null;
  };

  const handleSearchBuses = async () => {
    if (!searchStartStop.trim() || !searchEndStop.trim()) {
      alert('Please enter both start and end stop names');
      return;
    }

    setSearchLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/routes/search/buses`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startStopName: searchStartStop,
            endStopName: searchEndStop,
          }),
        },
      );
      setSearchResults(await response.json());
    } catch {
      alert('Error searching for buses');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchStartStop('');
    setSearchEndStop('');
  };

  const highlightedBusIds = searchResults ? searchResults.buses.map(getBusId) : [];
  const ringingBusId = Object.keys(activeAlarms)[0] || '';
  const ringingBus = ringingBusId ? buses[ringingBusId] ?? null : null;
  const ringingEtaMinutes = ringingBus ? getEtaMinutes(ringingBus) : null;
  const ringingEtaText =
    typeof ringingEtaMinutes === 'number' ? `${ringingEtaMinutes} min` : 'unknown ETA';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      <AlarmPopup
        open={Boolean(ringingBusId)}
        busName={ringingBus?.plateNumber || ringingBus?.busId || 'This bus'}
        stopName={armedBuses[ringingBusId] || 'your stop'}
        etaText={ringingEtaText}
        onStopAlarm={() => stopAlarm(ringingBusId)}
      />

      <MapToolbar
        status={status}
        mode={mode}
        onModeChange={setMode}
        busCount={visibleBuses.length}
        studentCount={visibleStudents.length}
        onLogout={onLogout}
      />

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <MapPane
          mode={mode}
          routes={routes}
          buses={visibleBuses}
          students={visibleStudents}
          highlightedBusIds={highlightedBusIds}
          onBusSelect={(bus) => setSelectedBusId(getBusId(bus))}
        />

        <Sidebar
          searchStartStop={searchStartStop}
          searchEndStop={searchEndStop}
          onStartStopChange={setSearchStartStop}
          onEndStopChange={setSearchEndStop}
          onSearch={handleSearchBuses}
          onClear={handleClearSearch}
          searchLoading={searchLoading}
          searchResults={searchResults}
          activeAlerts={activeAlerts}
          alertFeed={alertFeed}
          onClearAlert={clearAlert}
          selectedBusId={selectedBusId}
          onSelectBus={(bus) => setSelectedBusId(getBusId(bus))}
          armedBuses={armedBuses}
          activeAlarms={activeAlarms}
          onToggleArm={(bus) => toggleArmForBus(bus, searchStartStop)}
          onStopAlarm={stopAlarm}
          getEtaMinutes={getEtaMinutes}
          getBusId={getBusId}
          selectedBus={selectedBus}
          onCloseSelectedBus={() => setSelectedBusId('')}
        />
      </div>
    </div>
  );
}
