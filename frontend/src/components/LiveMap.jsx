import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function getRouteColor(index) {
  const palette = ['#3B82F6', '#F59E42', '#10B981', '#F43F5E', '#A78BFA', '#FBBF24', '#6366F1'];
  return palette[index % palette.length];
}

export default function LiveMap({ userId = '', userName = 'Student' }) {
  const socketRef = useRef(null);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState({});
  const [students, setStudents] = useState({});
  const [selectedBusId, setSelectedBusId] = useState('');
  const [status, setStatus] = useState('Connecting to live bus updates...');
  const [mode, setMode] = useState('simulated'); // 'simulated' or 'real'
  const [searchStartStop, setSearchStartStop] = useState('');
  const [searchEndStop, setSearchEndStop] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertFeed, setAlertFeed] = useState([]);

  useEffect(() => {
    let ignore = false;
    const loadRoutes = async () => {
      try {
        const response = await fetch(`${API_BASE}/routes`);
        const data = await response.json();
        if (!ignore) {
          setRoutes(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!ignore) {
          setStatus('Unable to load routes right now.');
        }
      }
    };
    loadRoutes();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    let watchId = null;

    const emitStudentLocation = (position) => {
      if (!userId) {
        return;
      }

      const speedMetersPerSecond = position.coords.speed ?? 0;
      const speedKmh = Math.max(0, speedMetersPerSecond * 3.6);

      socket.emit('update_location', {
        userId,
        role: 'STUDENT',
        name: userName,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        speed: speedKmh,
      });
    };

    const beginLocationTracking = () => {
      if (!userId) {
        setStatus('Student identity unavailable for live location.');
        return;
      }

      if (!navigator.geolocation) {
        setStatus('Geolocation is not supported in this browser.');
        return;
      }

      setStatus('Requesting location access...');

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          emitStudentLocation(position);
          setStatus('Sharing your live location.');
        },
        () => {
          setStatus('Location access denied or unavailable.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000,
        },
      );
    };

    socket.on('connect', () => {
      beginLocationTracking();
    });

    socket.on('bus_moved', (payload) => {
      // Map isSimulated to simulated for frontend filtering
      const mapped = { ...payload, simulated: payload.simulated ?? payload.isSimulated };
      console.log(
        `[FRONTEND] Bus moved: ${payload.busId} (Simulated: ${mapped.simulated}, Crowdsourced: ${payload.isCrowdsourced})`,
      );
      setBuses((current) => ({ ...current, [payload.busId]: mapped }));
      setStatus('Live bus updates connected.');
    });
    socket.on('buses_snapshot', (snapshot) => {
      const nextBuses = {};
      for (const bus of snapshot) {
        const mapped = { ...bus, simulated: bus.simulated ?? bus.isSimulated };
        nextBuses[bus.busId] = mapped;
      }
      const simulated = snapshot.filter(b => b.isSimulated).length;
      const crowdsourced = snapshot.filter(b => b.isCrowdsourced).length;
      const other = snapshot.length - simulated - crowdsourced;
      console.log(
        `[FRONTEND] Received buses_snapshot: Total ${snapshot.length} | Simulated: ${simulated}, Crowdsourced: ${crowdsourced}, Other: ${other}`,
      );
      console.log(`[FRONTEND] Bus IDs: ${snapshot.map(b => b.busId).join(', ')}`);
      setBuses(nextBuses);
      if (snapshot.length > 0) {
        setStatus('Loaded active buses from live snapshot.');
      }
    });
    socket.on('student_alerts_snapshot', (snapshot) => {
      setActiveAlerts(Array.isArray(snapshot) ? snapshot : []);
    });
    socket.on('student_alert_triggered', (payload) => {
      const alertSummary = {
        ...payload,
        triggeredAt: new Date().toISOString(),
      };

      setActiveAlerts((current) =>
        current.map((alert) =>
          alert.id === payload.alert.id
            ? {
                ...alert,
                triggeredBusIds: [...(alert.triggeredBusIds || []), payload.bus.busId],
              }
            : alert,
        ),
      );

      setAlertFeed((current) => [alertSummary, ...current].slice(0, 3));
      setStatus(payload.message || 'A bus alert was triggered.');

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SUBIS bus alert', {
          body: `${payload.message} ETA to your start stop: ${payload.etaMinutes ?? 'unknown'} min.`,
        });
      }
    });
    socket.on('students_snapshot', (snapshot) => {
      const nextStudents = {};
      for (const student of snapshot) {
        nextStudents[student.userId] = {
          ...student,
          isSimulated: Boolean(student.isSimulated),
        };
      }
      console.log(`[FRONTEND] Received students_snapshot: ${snapshot.length} students`);
      setStudents(nextStudents);
    });
    socket.on('student_moved', (payload) => {
      setStudents((current) => ({
        ...current,
        [payload.userId]: {
          ...payload,
          isSimulated: Boolean(payload.isSimulated),
        },
      }));
    });
    socket.on('student_removed', (payload) => {
      setStudents((current) => {
        const next = { ...current };
        delete next[payload.userId];
        return next;
      });
    });
    socket.on('connect_error', () => {
      setStatus('Live bus updates unavailable.');
    });
    return () => {
      socketRef.current = null;
      if (watchId !== null) {
        navigator.geolocation?.clearWatch(watchId);
      }
      socket.disconnect();
    };
  }, [userId, userName]);

  // Separate simulated and real buses, limit simulated to 3
  const busList = useMemo(() => Object.values(buses), [buses]);
  const simulatedBuses = busList.filter((b) => b.simulated).slice(0, 3);
  const realBuses = busList.filter((b) => !b.simulated);
  const studentList = useMemo(() => Object.values(students), [students]);
  const simulatedStudents = studentList
    .filter((student) => student.isSimulated)
    .slice(0, 3);
  const realStudents = studentList.filter((student) => !student.isSimulated);

  // Log bus breakdown whenever buses change
  useMemo(() => {
    console.log(
      `[FRONTEND_STATE] Total buses in state: ${busList.length} | Simulated: ${simulatedBuses.length} | Real: ${realBuses.length}`,
    );
    console.log(`[FRONTEND_STATE] Real bus IDs: ${realBuses.map(b => b.busId).join(', ') || 'None'}`);
  }, [busList, simulatedBuses, realBuses]);

  // Assign colors to routes
  const routesWithColor = useMemo(() => routes.map((r, i) => ({ ...r, color: getRouteColor(i) })), [routes]);

  // Select buses based on mode
  const visibleBuses = mode === 'simulated' ? simulatedBuses : realBuses;
  const visibleStudents = mode === 'simulated' ? simulatedStudents : realStudents;
  const selectedBus = selectedBusId ? buses[selectedBusId] : null;

  useEffect(() => {
    if (!selectedBusId) {
      return;
    }

    if (!visibleBuses.some((bus) => bus.busId === selectedBusId)) {
      setSelectedBusId('');
    }
  }, [selectedBusId, visibleBuses]);

  const handleSelectBus = (bus) => {
    setSelectedBusId(bus.busId || bus.id || '');
    console.log(selectedBus)
  };

  const handleSearchBuses = async () => {
    if (!searchStartStop.trim() || !searchEndStop.trim()) {
      alert('Please enter both start and end stop names');
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch(`${API_BASE}/routes/search/buses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startStopName: searchStartStop,
          endStopName: searchEndStop,
        }),
      });
      const data = await response.json();
      setSearchResults(data);
      console.log('Search results:', data);
    } catch (error) {
      console.error('Search error:', error);
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

  const requestBrowserNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    return Notification.requestPermission();
  };

  const findTriggerStopForRoute = (route) => {
    const normalizedStart = searchStartStop.toLowerCase().trim();
    const stops = Array.isArray(route?.stops) ? route.stops : [];
    const startIndex = stops.findIndex(
      (stop) => stop.name.toLowerCase().trim() === normalizedStart,
    );

    if (startIndex <= 0) {
      return null;
    }

    return stops[startIndex - 1] ?? null;
  };

  const handleCreateAlert = async (route) => {
    if (!route?.id) {
      setStatus('Select a matching route before creating an alert.');
      return;
    }

    const triggerStop = findTriggerStopForRoute(route);
    if (!triggerStop) {
      setStatus('A previous stop could not be determined for this route.');
      return;
    }

    const permission = await requestBrowserNotificationPermission();
    if (permission === 'denied') {
      setStatus('Browser notifications are blocked, so alerts will stay in the app.');
    }

    socketRef.current?.emit('register_student_alert', {
      routeId: route.id,
      routeName: route.name,
      startStopName: searchStartStop,
      endStopName: searchEndStop,
      triggerStopName: triggerStop.name,
      triggerStopOrder: triggerStop.order,
    });

    setStatus(`Alert created for ${route.name}. You will be notified when the bus reaches ${triggerStop.name}.`);
  };

  const handleClearAlert = (alertId) => {
    socketRef.current?.emit('clear_student_alert', { alertId });
    setActiveAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  // Log when mode changes or buses are displayed
  useMemo(() => {
    console.log(
      `[FRONTEND_DISPLAY] Mode: ${mode.toUpperCase()} | Showing ${visibleBuses.length} buses | ${visibleStudents.length} students`,
    );
    if (mode === 'real') {
      console.log(`[FRONTEND_DISPLAY] Real mode buses: ${visibleBuses.map(b => `${b.busId}(P:${b.probabilityScore || 'N/A'}%)`).join(', ') || 'None'}`);
    }
  }, [mode, visibleBuses, visibleStudents]);

  return (
    <div className="student-map-layout">
      <div className="map-toolbar">
        <div>
          <h3>Live bus map</h3>
          <p>{status}</p>
        </div>
        <div className={`data-mode-indicator ${mode === 'simulated' ? 'simulated' : 'realtime'}`}>
          <span className="mode-indicator-dot" />
          {mode === 'simulated' ? 'Simulation mode' : 'Real-time mode'}
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Buses shown</span>
          <strong>{visibleBuses.length}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Students on map</span>
          <strong>{visibleStudents.length}</strong>
        </div>
        <div className="mode-toggle" style={{ marginLeft: 'auto' }}>
          <button
            className={`mode-toggle-btn ${mode === 'simulated' ? 'active' : ''}`}
            type="button"
            onClick={() => setMode('simulated')}
            aria-pressed={mode === 'simulated'}
          >
            Simulated
          </button>
          <button
            className={`mode-toggle-btn ${mode === 'real' ? 'active' : ''}`}
            type="button"
            onClick={() => setMode('real')}
            aria-pressed={mode === 'real'}
          >
            Real Time
          </button>
        </div>
      </div>
      <div className="student-layout-grid live-map-grid">
        <div className={`map-frame dashboard-map-frame ${mode === 'simulated' ? 'simulation-active' : ''}`}>
          {mode === 'simulated' && (
            <div className="simulation-banner" role="status" aria-live="polite">
              Simulation feed active: buses and students shown here are generated sample data.
            </div>
          )}
          <TransitMap
            routes={routesWithColor}
            buses={visibleBuses}
            students={visibleStudents}
            onBusSelect={handleSelectBus}
            highlightedBusIds={searchResults ? searchResults.buses.map(b => b.id || b.busId) : []}
          />
        </div>
        <div className="panel bus-details-panel">
          <div className="panel-header">
            <h3>Search for Buses</h3>
          </div>
          <div className="search-form">
            <div className="form-group">
              <label htmlFor="start-stop">Start Stop</label>
              <input
                id="start-stop"
                type="text"
                placeholder="e.g., Main Station"
                value={searchStartStop}
                onChange={(e) => setSearchStartStop(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchBuses()}
              />
            </div>
            <div className="form-group">
              <label htmlFor="end-stop">End Stop</label>
              <input
                id="end-stop"
                type="text"
                placeholder="e.g., City Center"
                value={searchEndStop}
                onChange={(e) => setSearchEndStop(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearchBuses()}
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleSearchBuses}
                disabled={searchLoading}
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
              {searchResults && (
                <button className="btn-secondary" onClick={handleClearSearch}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {searchResults?.routes?.length > 0 && (
            <div className="panel-subsection">
              <div className="panel-header">
                <h4>Matching routes</h4>
              </div>
              <div className="route-list">
                {searchResults.routes.map((route) => {
                  const triggerStop = findTriggerStopForRoute(route);
                  return (
                    <div key={route.id} className="route-list-item">
                      <div>
                        <strong>{route.name}</strong>
                        <p>
                          Alert stop: {triggerStop ? triggerStop.name : 'Previous stop unavailable'}
                        </p>
                      </div>
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => handleCreateAlert(route)}
                        disabled={!triggerStop}
                      >
                        Set alert
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeAlerts.length > 0 && (
            <div className="panel-subsection">
              <div className="panel-header">
                <h4>Active alerts</h4>
              </div>
              <div className="buses-list">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="bus-item">
                    <div className="bus-item-header">
                      <strong>{alert.routeName}</strong>
                      <span className="route-badge">{alert.startStopName}</span>
                    </div>
                    <div className="bus-item-info">
                      <span>Trigger: {alert.triggerStopName}</span>
                      <span>
                        {alert.triggeredBusIds?.length > 0
                          ? `Triggered for ${alert.triggeredBusIds.length} bus trip(s)`
                          : 'Waiting'}
                      </span>
                    </div>
                    <div className="form-actions">
                      <button className="btn-secondary" type="button" onClick={() => handleClearAlert(alert.id)}>
                        Clear
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertFeed.length > 0 && (
            <div className="panel-subsection">
              <div className="panel-header">
                <h4>Latest alert</h4>
              </div>
              <div className="banner success">
                {alertFeed[0].message} ETA to start stop: {alertFeed[0].etaMinutes ?? 'unknown'} min.
              </div>
            </div>
          )}

          {searchResults && (
            <div className="search-results">
              <div className="results-header">
                <h4>{searchResults.message}</h4>
              </div>
              {searchResults.buses.length > 0 ? (
                <div className="buses-list">
                  {searchResults.buses.map((bus) => (
                    <div
                      key={bus.id || bus.busId}
                      className={`bus-item ${selectedBusId === (bus.busId || bus.id) ? 'active' : ''}`}
                      onClick={() => handleSelectBus(bus)}
                    >
                      <div className="bus-item-header">
                        <strong>{bus.plateNumber || bus.busId}</strong>
                        <span className="route-badge" style={{ backgroundColor: bus.routeColor }}>
                          {bus.routeName}
                        </span>
                      </div>
                      <div className="bus-item-info">
                        {bus.currentStop && <span>📍 {bus.currentStop}</span>}
                        {bus.speed && <span>⚡ {Math.round(bus.speed)} km/h</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel-empty">No buses found for this route</div>
              )}
            </div>
          )}
        </div>

        {selectedBus && (
          <div className="panel bus-details-panel">
            <div className="panel-header">
              <h3>Bus Details</h3>
              <button className="close-btn" onClick={() => setSelectedBusId('')}>✕</button>
            </div>
            <div className="bus-details-grid">
              <div className="bus-details-header-row">
                <strong>{selectedBus.plateNumber || selectedBus.busId || selectedBus.id}</strong>
                {selectedBus.simulated && <span className="bus-badge simulated">Simulated</span>}
                {!selectedBus.simulated && <span className="bus-badge live">Real-time</span>}
              </div>
              <div className="bus-details-row">
                <span className="detail-label">Route</span>
                <strong>{selectedBus.routeName || selectedBus.routeId || 'Unknown route'}</strong>
              </div>
              <div className="bus-details-row">
                <span className="detail-label">Current stop</span>
                <strong>{selectedBus.currentStop || 'Between stops'}</strong>
              </div>
              <div className="bus-details-row">
                <span className="detail-label">Next stop</span>
                <strong>{selectedBus.nextStop || selectedBus.nearestStop || 'Not available'}</strong>
              </div>
              <div className="bus-details-row">
                <span className="detail-label">ETA</span>
                <strong>
                  {typeof selectedBus.nextStopEtaMinutes === 'number'
                    ? `${selectedBus.nextStopEtaMinutes} min`
                    : 'Not available'}
                </strong>
              </div>
              <div className="bus-details-row">
                <span className="detail-label">Speed</span>
                <strong>{Math.round(selectedBus.speed || 0)} km/h</strong>
              </div>
              <div className="bus-details-row">
                <span className="detail-label">Last update</span>
                <strong>
                  {selectedBus.lastUpdate
                    ? new Date(selectedBus.lastUpdate).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Unknown'}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
