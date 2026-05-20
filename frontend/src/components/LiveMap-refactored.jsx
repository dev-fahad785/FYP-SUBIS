import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import AlarmPopup from './AlarmPopup';
import TransitMap from './TransitMap';
import BusListItem from './BusListItem';
import BusDetailsPanel from './BusDetailsPanel';
import AlertFeedBanner from './AlertFeedBanner';
import ActiveAlertsList from './ActiveAlertsList';
import { useSocketData } from '../hooks/useSocketData';
import { useAlarms } from '../hooks/useAlarms';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const ROUTE_PALETTE = ['#3B82F6', '#38BDF8', '#0EA5E9', '#22C55E', '#14B8A6', '#6366F1', '#8B5CF6'];
const getRouteColor = (index) => ROUTE_PALETTE[index % ROUTE_PALETTE.length];
const getBusId = (bus) => bus?.busId || bus?.id || '';

function GlassSearchBar({
  id,
  value,
  placeholder,
  onChange,
}) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] border border-cyan-100/15 bg-[linear-gradient(180deg,rgba(96,165,250,0.22),rgba(15,23,42,0.22))] px-4 py-3 shadow-[0_12px_32px_rgba(8,47,73,0.28)] backdrop-blur-2xl">
      <span className="text-cyan-100/85">⌕</span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-white placeholder:text-cyan-50/45 focus:outline-none"
      />
    </div>
  );
}

export default function LiveMap({ userId = '', userName = 'Student', onLogout }) {
  const [routes, setRoutes] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [mode, setMode] = useState('simulated');
  const [searchStartStop, setSearchStartStop] = useState('');
  const [searchEndStop, setSearchEndStop] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [showResultsPanel, setShowResultsPanel] = useState(false);

  const { buses, students, activeAlerts, alertFeed, status, clearAlert } = useSocketData(
    userId,
    userName,
  );
  const { armedBuses, activeAlarms, toggleArmForBus, stopAlarm } = useAlarms(buses);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/routes`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRoutes(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const busList = useMemo(() => Object.values(buses), [buses]);
  const studentList = useMemo(() => Object.values(students), [students]);
  const armedBusIds = useMemo(() => Object.keys(armedBuses), [armedBuses]);
  const focusBusId = useMemo(() => {
    if (selectedBusId && armedBuses[selectedBusId]) {
      return selectedBusId;
    }
    return armedBusIds[0] || '';
  }, [armedBuses, armedBusIds, selectedBusId]);
  const focusModeActive = Boolean(focusBusId);

  const baseVisibleBuses = useMemo(
    () => busList.filter((bus) => (mode === 'simulated' ? bus.simulated : !bus.simulated)),
    [busList, mode],
  );

  const visibleStudents = useMemo(() => {
    if (focusModeActive) return [];
    const all = studentList.filter((student) =>
      mode === 'simulated' ? student.isSimulated : !student.isSimulated,
    );
    return mode === 'simulated' ? all.slice(0, 3) : all;
  }, [focusModeActive, mode, studentList]);

  const routesWithColor = useMemo(
    () => routes.map((route, index) => ({ ...route, color: route.color || getRouteColor(index) })),
    [routes],
  );

  const filteredRoutes = useMemo(() => {
    if (!focusModeActive) return routesWithColor;
    const focusedBus = buses[focusBusId];
    if (!focusedBus?.routeId) return [];
    return routesWithColor.filter((route) => route.id === focusedBus.routeId);
  }, [buses, focusBusId, focusModeActive, routesWithColor]);

  const visibleBuses = useMemo(() => {
    if (!focusModeActive) return baseVisibleBuses;
    return baseVisibleBuses.filter((bus) => getBusId(bus) === focusBusId);
  }, [baseVisibleBuses, focusBusId, focusModeActive]);

  const selectedBus = selectedBusId
    ? buses[selectedBusId] ?? searchResults?.buses?.find((bus) => getBusId(bus) === selectedBusId) ?? null
    : null;

  const getEtaMinutes = (bus) => {
    const liveBus = buses[getBusId(bus)] ?? bus;
    const normalizedStart = searchStartStop.toLowerCase().trim();
    const match = (liveBus?.etas ?? []).find(
      (eta) => eta.stopName?.toLowerCase().trim() === normalizedStart,
    );
    return typeof match?.estimatedMinutes === 'number' ? match.estimatedMinutes : null;
  };

  const searchActive = Boolean(searchResults);
  const matchingBuses = useMemo(() => {
    if (!searchResults?.buses?.length) return [];
    return searchResults.buses
      .map((bus) => buses[getBusId(bus)] ?? bus)
      .filter((bus) => {
        if (focusModeActive) {
          return getBusId(bus) === focusBusId;
        }
        return mode === 'simulated' ? Boolean(bus.simulated) : !bus.simulated;
      });
  }, [buses, focusBusId, focusModeActive, mode, searchResults]);

  const highlightedBusIds = useMemo(() => {
    const ids = new Set();
    if (selectedBusId) ids.add(selectedBusId);
    matchingBuses.forEach((bus) => ids.add(getBusId(bus)));
    if (focusBusId) ids.add(focusBusId);
    return Array.from(ids);
  }, [focusBusId, matchingBuses, selectedBusId]);

  const ringingBusId = Object.keys(activeAlarms)[0] || '';
  const ringingBus = ringingBusId ? buses[ringingBusId] ?? null : null;
  const ringingEtaMinutes = ringingBus ? getEtaMinutes(ringingBus) : null;
  const ringingEtaText =
    typeof ringingEtaMinutes === 'number' ? `${ringingEtaMinutes} min` : 'unknown ETA';

  useEffect(() => {
    if (searchResults) {
      setShowResultsPanel(true);
    }
  }, [searchResults]);

  useEffect(() => {
    if (selectedBusId) {
      setShowResultsPanel(true);
    }
  }, [selectedBusId]);

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
        body: JSON.stringify({
          startStopName: searchStartStop,
          endStopName: searchEndStop,
        }),
      });
      const data = await res.json();
      setSearchResults({
        buses: Array.isArray(data?.buses) ? data.buses : [],
        routes: Array.isArray(data?.routes) ? data.routes : [],
        totalBuses: typeof data?.totalBuses === 'number' ? data.totalBuses : 0,
        message: typeof data?.message === 'string' ? data.message : 'Search complete.',
      });
      setShowResultsPanel(true);
    } catch {
      setSearchResults({
        buses: [],
        routes: [],
        totalBuses: 0,
        message: 'Unable to search buses right now.',
      });
      setShowResultsPanel(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults(null);
    setSearchStartStop('');
    setSearchEndStop('');
    setShowResultsPanel(false);
  };

  const handleSelectBus = (bus) => {
    setSelectedBusId(getBusId(bus));
    setShowResultsPanel(true);
  };

  const renderBusCard = (bus, origin = 'results') => {
    const id = getBusId(bus);
    return (
      <BusListItem
        key={`${origin}-${id}`}
        bus={bus}
        isSelected={selectedBusId === id}
        etaMinutes={getEtaMinutes(bus)}
        searchStartStop={searchStartStop}
        armed={Boolean(armedBuses[id])}
        alarming={Boolean(activeAlarms[id])}
        onSelect={() => handleSelectBus(bus)}
        onToggleArm={() => toggleArmForBus(bus, searchStartStop)}
        onStopAlarm={() => stopAlarm(id)}
        getBusId={getBusId}
      />
    );
  };

  const displayName = userName?.trim() || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'S';

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-[#03111f] text-white">
      <AlarmPopup
        open={Boolean(ringingBusId)}
        busName={ringingBus?.plateNumber || ringingBus?.busId || 'This bus'}
        stopName={armedBuses[ringingBusId] || 'your stop'}
        etaText={ringingEtaText}
        onStopAlarm={() => stopAlarm(ringingBusId)}
      />

      <div className="absolute inset-0">
        <TransitMap
          routes={filteredRoutes}
          buses={visibleBuses}
          students={visibleStudents}
          onBusSelect={handleSelectBus}
          highlightedBusIds={highlightedBusIds}
          hideRoutes={false}
          hideStops={false}
          fitToBusesOnly={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_28%),linear-gradient(180deg,rgba(2,12,24,0.46)_0%,rgba(2,12,24,0.10)_20%,rgba(2,12,24,0.42)_100%)]" />
      </div>

      <div className="absolute inset-x-0 top-0 z-[600] px-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-4">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-[22px] border border-cyan-100/14 bg-[linear-gradient(180deg,rgba(59,130,246,0.22),rgba(2,12,24,0.22))] px-3 py-2 shadow-[0_14px_32px_rgba(8,47,73,0.20)] backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-slate-950">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="mt-0.5 text-xs font-medium text-cyan-100/80 transition hover:text-white"
                    >
                      Log out
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-[18px] border border-cyan-100/12 bg-[linear-gradient(180deg,rgba(59,130,246,0.18),rgba(2,12,24,0.18))] px-4 py-2 text-xs font-semibold text-cyan-50/85 backdrop-blur-xl transition hover:text-white"
                onClick={() => setShowResultsPanel((current) => !current)}
              >
                {showResultsPanel ? 'Hide list' : 'Open list'}
              </button>
              <div className="flex rounded-[22px] border border-cyan-100/12 bg-[linear-gradient(180deg,rgba(96,165,250,0.24),rgba(15,23,42,0.18))] p-1 shadow-[0_14px_32px_rgba(2,132,199,0.18)] backdrop-blur-2xl">
                <button
                  type="button"
                  className={`rounded-[18px] px-4 py-2 text-xs font-semibold transition ${
                    mode === 'simulated'
                      ? 'bg-white text-slate-950'
                      : 'text-cyan-50/85 hover:text-white'
                  }`}
                  onClick={() => setMode('simulated')}
                >
                  Demo
                </button>
                <button
                  type="button"
                  className={`rounded-[18px] px-4 py-2 text-xs font-semibold transition ${
                    mode === 'real'
                      ? 'bg-white text-slate-950'
                      : 'text-cyan-50/85 hover:text-white'
                  }`}
                  onClick={() => setMode('real')}
                >
                  Live
                </button>
              </div>
            </div>
          </div>

          {showSearchPanel && !focusModeActive && (
            <div className="rounded-[28px] border border-cyan-100/14 bg-[linear-gradient(180deg,rgba(59,130,246,0.22),rgba(2,12,24,0.28))] p-3 shadow-[0_20px_48px_rgba(8,47,73,0.24)] backdrop-blur-2xl">
              <div className="grid gap-3">
                <GlassSearchBar
                  id="start-stop"
                  value={searchStartStop}
                  placeholder="Start stop"
                  onChange={setSearchStartStop}
                />
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <GlassSearchBar
                      id="end-stop"
                      value={searchEndStop}
                      placeholder="Destination stop"
                      onChange={setSearchEndStop}
                    />
                  </div>
                  <button
                    type="button"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-cyan-100/18 bg-cyan-300 text-slate-950 shadow-[0_14px_32px_rgba(103,232,249,0.28)] transition hover:bg-cyan-200 disabled:opacity-45"
                    onClick={handleSearchBuses}
                    disabled={searchLoading}
                    aria-label="Search buses"
                  >
                    {searchLoading ? '...' : '⌕'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showResultsPanel && (
        <div className="absolute inset-x-0 bottom-0 z-[650] px-0 pb-[max(env(safe-area-inset-bottom),0rem)] sm:px-5 sm:pb-5">
          <div className="mx-auto max-w-3xl rounded-t-[30px] border border-cyan-100/14 bg-[linear-gradient(180deg,rgba(59,130,246,0.24),rgba(2,12,24,0.86))] shadow-[0_-18px_50px_rgba(2,12,24,0.52)] backdrop-blur-3xl sm:rounded-[30px]">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                type="button"
                className="mx-auto h-1.5 w-16 rounded-full bg-cyan-50/28 sm:hidden"
                aria-hidden="true"
              />
              <div className="hidden text-sm font-semibold text-white sm:block">
                {selectedBus ? 'Selected bus details' : searchActive ? 'Matching buses' : 'Live buses'}
              </div>
              <button
                type="button"
                className="rounded-[18px] border border-cyan-100/12 bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-50/85 transition hover:text-white"
                onClick={() => setShowResultsPanel(false)}
              >
                Close
              </button>
            </div>

            <div className="max-h-[58dvh] overflow-y-auto px-3 pb-4 sm:px-4">
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

              {focusModeActive && (
                <div className="mb-4 rounded-[24px] border border-cyan-100/12 bg-cyan-300/10 p-4 text-sm text-cyan-50/90">
                  Alarm is armed. The map is now focused on the selected bus only.
                </div>
              )}

              {!focusModeActive && searchActive && (
                <div className="mb-4 grid gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                        Search results
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-white">
                        Buses from {searchStartStop || 'start'} to {searchEndStop || 'destination'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="rounded-[18px] border border-cyan-100/12 bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-50/85 transition hover:text-white"
                      onClick={handleClearSearch}
                    >
                      Clear
                    </button>
                  </div>

                  {matchingBuses.length > 0 ? (
                    <div className="grid gap-3">
                      {matchingBuses.map((bus) => renderBusCard(bus, 'matching'))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-cyan-100/14 bg-white/[0.03] px-5 py-8 text-center text-sm text-cyan-50/75">
                      No buses are visible for this trip in the current mode.
                    </div>
                  )}
                </div>
              )}

              {!focusModeActive && !searchActive && (
                <div className="mb-4 grid gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                      Live fleet
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-white">
                      All buses currently shown on the map
                    </h3>
                  </div>
                  <div className="grid gap-3">
                    {visibleBuses.map((bus) => renderBusCard(bus, 'fleet'))}
                  </div>
                </div>
              )}

              {!focusModeActive && (
                <>
                  <AlertFeedBanner alert={alertFeed[0]} />
                  <div className="mt-4">
                    <ActiveAlertsList alerts={activeAlerts} onClear={clearAlert} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
