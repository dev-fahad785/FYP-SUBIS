import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import AlarmPopup from './AlarmPopup';
import TransitMap from './TransitMap';
import MapToolbar from './MapToolbar';
import BusSearchPanel from './BusSearchPanel';
import BusDetailsPanel from './BusDetailsPanel';
import { useSocketData } from '../hooks/useSocketData';
import { useAlarms } from '../hooks/useAlarms';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const ROUTE_PALETTE = ['#3B82F6', '#F59E42', '#10B981', '#F43F5E', '#A78BFA', '#FBBF24', '#6366F1'];
const getRouteColor = (index) => ROUTE_PALETTE[index % ROUTE_PALETTE.length];

const getBusId = (bus) => bus?.busId || bus?.id || '';

export default function LiveMap({ userId = '', userName = 'Student' }) {
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [mode, setMode] = useState('simulated');
  const [searchStartStop, setSearchStartStop] = useState('');
  const [searchEndStop, setSearchEndStop] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // --- Data hooks ---
  const { buses, students, activeAlerts, alertFeed, status, clearAlert } = useSocketData(
    userId,
    userName,
  );
  const { armedBuses, activeAlarms, toggleArmForBus, stopAlarm } = useAlarms(buses);

  // --- Route loading ---
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/routes`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setRoutes(Array.isArray(data) ? data : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // --- Derived bus/student lists ---
  const busList = useMemo(() => Object.values(buses), [buses]);
  const studentList = useMemo(() => Object.values(students), [students]);

  const visibleBuses = useMemo(
    () => busList.filter((b) => (mode === 'simulated' ? b.simulated : !b.simulated)),
    [busList, mode],
  );
  const visibleStudents = useMemo(() => {
    const all = studentList.filter((s) => (mode === 'simulated' ? s.isSimulated : !s.isSimulated));
    return mode === 'simulated' ? all.slice(0, 3) : all;
  }, [studentList, mode]);

  const routesWithColor = useMemo(
    () => routes.map((r, i) => ({ ...r, color: getRouteColor(i) })),
    [routes],
  );

  // --- ETA helper ---
  const getEtaMinutes = (bus) => {
    const liveBus = buses[getBusId(bus)] ?? bus;
    const normalizedStart = searchStartStop.toLowerCase().trim();
    const match = (liveBus?.etas ?? []).find(
      (e) => e.stopName?.toLowerCase().trim() === normalizedStart,
    );
    return typeof match?.estimatedMinutes === 'number' ? match.estimatedMinutes : null;
  };

  // --- Selected bus (from live state or search results) ---
  const selectedBus = selectedBusId
    ? (buses[selectedBusId] ?? searchResults?.buses?.find((b) => getBusId(b) === selectedBusId) ?? null)
    : null;

  // --- Bus search ---
  const handleSearchBuses = async () => {
    if (!searchStartStop.trim() || !searchEndStop.trim()) {
      alert('Please enter both start and end stop names');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/routes/search/buses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startStopName: searchStartStop, endStopName: searchEndStop }),
      });
      setSearchResults(await res.json());
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

  // --- Alarm display ---
  const ringingBusId = Object.keys(activeAlarms)[0] || '';
  const ringingBus = ringingBusId ? (buses[ringingBusId] ?? null) : null;
  const ringingEtaMinutes = ringingBus ? getEtaMinutes(ringingBus) : null;
  const ringingEtaText =
    typeof ringingEtaMinutes === 'number' ? `${ringingEtaMinutes} min` : 'unknown ETA';

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
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
      />

      <div className="flex flex-1 overflow-hidden gap-3 p-3">
        {/* Map */}
        <div
          className={`relative flex-1 rounded-xl overflow-hidden border transition-colors ${
            mode === 'simulated' ? 'border-amber-800/40' : 'border-gray-700'
          }`}
        >
          {mode === 'simulated' && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-950/90 text-amber-300 text-xs px-4 py-1.5 rounded-full border border-amber-700/50 backdrop-blur-sm whitespace-nowrap"
              role="status"
              aria-live="polite"
            >
              Simulation feed active — buses and students shown are generated sample data
            </div>
          )}
          <TransitMap
            routes={routesWithColor}
            buses={visibleBuses}
            students={visibleStudents}
            onBusSelect={(bus) => setSelectedBusId(getBusId(bus))}
            highlightedBusIds={searchResults ? searchResults.buses.map(getBusId) : []}
          />
        </div>

        {/* Side panels */}
        <div className="flex flex-col gap-3 w-80 overflow-y-auto shrink-0">
          <BusSearchPanel
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
          />

          {selectedBus && (
            <BusDetailsPanel
              bus={selectedBus}
              onClose={() => setSelectedBusId('')}
              etaToStartStop={getEtaMinutes(selectedBus)}
              armedBuses={armedBuses}
              activeAlarms={activeAlarms}
              onToggleArm={(bus) => toggleArmForBus(bus, searchStartStop)}
              onStopAlarm={stopAlarm}
              getBusId={getBusId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
