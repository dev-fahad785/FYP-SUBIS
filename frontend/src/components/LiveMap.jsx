import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import AlarmPopup from './AlarmPopup';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const DEFAULT_CENTER = [29.3783, 71.7738];
const DEFAULT_ZOOM = 14;

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
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [searchStartStop, setSearchStartStop] = useState('');
  const [searchEndStop, setSearchEndStop] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertFeed, setAlertFeed] = useState([]);
  const [armedBuses, setArmedBuses] = useState({}); // { [busId]: startStopName }
  const [activeAlarms, setActiveAlarms] = useState({}); // { [busId]: true }
  const audioRef = useRef(null);

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
    // initialize alarm audio; user should place their alert file at /alarm.mp3
    try {
      audioRef.current = new Audio('/alarm.mp3');
      audioRef.current.loop = true;
    } catch (e) {
      console.warn('Alarm audio unavailable', e);
    }

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
      // console.log(
      //   `[FRONTEND] Bus moved: ${payload.busId} (Simulated: ${mapped.simulated}, Crowdsourced: ${payload.isCrowdsourced})`,
      // );
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
      // console.log(
      //   `[FRONTEND] Received buses_snapshot: Total ${snapshot.length} | Simulated: ${simulated}, Crowdsourced: ${crowdsourced}, Other: ${other}`,
      // );
      // console.log(`[FRONTEND] Bus IDs: ${snapshot.map(b => b.busId).join(', ')}`);
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
      // console.log(`[FRONTEND] Received students_snapshot: ${snapshot.length} students`);
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

  // Toggle client-only armed state for a bus (associate with current searchStartStop)
  const toggleArmForBus = (bus) => {
    const busId = getBusId(bus);
    if (!busId) return;
    setArmedBuses((current) => {
      const next = { ...current };
      if (next[busId]) {
        delete next[busId];
      } else if (searchStartStop && searchStartStop.trim()) {
        next[busId] = searchStartStop.trim();
      } else {
        // fallback: use bus.currentStop as target if user didn't enter a start stop
        next[busId] = (bus.currentStop || '').trim();
      }
      return next;
    });
  };

  const stopAlarmForBus = (busId) => {
    setActiveAlarms((current) => {
      const next = { ...current };
      delete next[busId];
      return next;
    });
    try {
      audioRef.current?.pause();
      audioRef.current && (audioRef.current.currentTime = 0);
    } catch (e) {
      // ignore
    }
  };

  // Watch live buses and armedBuses to trigger client-side alarm when bus is one stop before start stop
  useEffect(() => {
    if (!audioRef.current) return;

    const armedIds = Object.keys(armedBuses);
    if (armedIds.length === 0) return;

    for (const busId of armedIds) {
      const startStopName = (armedBuses[busId] || '').toLowerCase().trim();
      const liveBus = buses[busId];
      if (!liveBus || !Array.isArray(liveBus.etas)) continue;

      const etas = liveBus.etas;
      const startIndex = etas.findIndex((eta) => eta.stopName?.toLowerCase().trim() === startStopName);
      if (startIndex <= 0) continue; // either not found or it's the first stop

      const prevEta = etas[startIndex - 1];
      const prevStopName = prevEta?.stopName?.toLowerCase().trim() || '';

      const isAtPrevStop = (liveBus.currentStop || '').toLowerCase().trim() === prevStopName
        || (liveBus.nearestStop || '').toLowerCase().trim() === prevStopName;

      const prevMinutes = typeof prevEta?.estimatedMinutes === 'number' ? prevEta.estimatedMinutes : null;

      const shouldTrigger = isAtPrevStop || (prevMinutes !== null && prevMinutes <= 1);

      if (shouldTrigger && !activeAlarms[busId]) {
        // start alarm
        try {
          audioRef.current.play().catch(() => null);
        } catch (e) {
          // ignore playback errors
        }
        setActiveAlarms((current) => ({ ...current, [busId]: true }));

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('SUBIS bus alert', {
            body: `Bus ${liveBus.plateNumber || liveBus.busId} is approaching your start stop.`,
          });
        }
      }
    }

    // no cleanup needed here; stopping handled by user action
  }, [buses, armedBuses, activeAlarms]);

  // Separate simulated and real buses, limit simulated to 3
  const busList = useMemo(() => Object.values(buses), [buses]);
  const simulatedBuses = busList.filter((b) => b.simulated);
  const realBuses = busList.filter((b) => !b.simulated);
  const studentList = useMemo(() => Object.values(students), [students]);
  const simulatedStudents = studentList
    .filter((student) => student.isSimulated)
    .slice(0, 3);
  const realStudents = studentList.filter((student) => !student.isSimulated);

  // Log bus breakdown whenever buses change
  // useMemo(() => {
  //   console.log(
  //     `[FRONTEND_STATE] Total buses in state: ${busList.length} | Simulated: ${simulatedBuses.length} | Real: ${realBuses.length}`,
  //   );
  //   console.log(`[FRONTEND_STATE] Real bus IDs: ${realBuses.map(b => b.busId).join(', ') || 'None'}`);
  // }, [busList, simulatedBuses, realBuses]);

  // Assign colors to routes
  const routesWithColor = useMemo(() => routes.map((r, i) => ({ ...r, color: getRouteColor(i) })), [routes]);

  // Select buses based on mode
  const visibleBuses = mode === 'simulated' ? simulatedBuses : realBuses;
  const visibleStudents = mode === 'simulated' ? simulatedStudents : realStudents;
  const getBusId = (bus) => bus?.busId || bus?.id || '';

  const getLiveBusForBus = (bus) => {
    const busId = getBusId(bus);
    return busId ? buses[busId] ?? null : null;
  };

  const getEtaToStartStopMinutes = (bus) => {
    const liveBus = getLiveBusForBus(bus);
    const etaSource = liveBus?.etas ?? bus?.etas ?? [];
    const normalizedStart = searchStartStop.toLowerCase().trim();

    const matchingEta = etaSource.find(
      (eta) => eta.stopName.toLowerCase().trim() === normalizedStart,
    );

    if (typeof matchingEta?.estimatedMinutes === 'number') {
      return matchingEta.estimatedMinutes;
    }

    return null;
  };

  const selectedBus = selectedBusId
    ? buses[selectedBusId] ?? searchResults?.buses?.find((bus) => getBusId(bus) === selectedBusId) ?? null
    : null;

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

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported in this browser.');
      return;
    }

    setStatus('Locating you on the map...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setMapCenter([position.coords.latitude, position.coords.longitude]);
        setMapZoom(16);
        setStatus('Centered on your location.');
      },
      () => {
        setStatus('Unable to access your location right now.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );
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

  // Log when mode changes or buses are displayed
  useMemo(() => {
    console.log(
      `[FRONTEND_DISPLAY] Mode: ${mode.toUpperCase()} | Showing ${visibleBuses.length} buses | ${visibleStudents.length} students`,
    );
    if (mode === 'real') {
      console.log(`[FRONTEND_DISPLAY] Real mode buses: ${visibleBuses.map(b => `${b.busId}(P:${b.probabilityScore || 'N/A'}%)`).join(', ') || 'None'}`);
    }
  }, [mode, visibleBuses, visibleStudents]);

  const selectedBusDetails = selectedBus
    ? {
        title: selectedBus.plateNumber || selectedBus.busId || selectedBus.id,
        route: selectedBus.routeName || selectedBus.routeId || 'Unknown route',
        stop: selectedBus.currentStop || 'Between stops',
        nextStop: selectedBus.nextStop || selectedBus.nearestStop || 'Not available',
        eta:
          typeof selectedBus.nextStopEtaMinutes === 'number'
            ? `${selectedBus.nextStopEtaMinutes} min`
            : 'Not available',
      }
    : null;

  return (
    <div
      className="student-map-layout"
      style={{
        position: 'relative',
        minHeight: 'calc(100dvh - 180px)',
        overflow: 'hidden',
        borderRadius: '16px',
      }}
    >
      <div
        className={`map-frame dashboard-map-frame ${mode === 'simulated' ? 'simulation-active' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
        }}
      >
        {mode === 'simulated' && (
          <div className="simulation-banner" role="status" aria-live="polite">
            Simulation feed active: buses and students shown here are generated sample data.
          </div>
        )}
        <TransitMap
          routes={routesWithColor}
          buses={visibleBuses}
          students={visibleStudents}
          center={mapCenter}
          zoom={mapZoom}
          onBusSelect={handleSelectBus}
          highlightedBusIds={searchResults ? searchResults.buses.map((b) => b.id || b.busId) : []}
        />
      </div>

      <div
        className="panel"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          zIndex: 20,
          gap: '12px',
          padding: '16px',
          backdropFilter: 'blur(14px)',
          background: 'rgba(8, 13, 24, 0.78)',
          maxWidth: 'min(820px, calc(100% - 32px))',
        }}
      >
        <div className="panel-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0 }}>Live bus map</h3>
            <p>{status}</p>
          </div>
          <div className={`data-mode-indicator ${mode === 'simulated' ? 'simulated' : 'realtime'}`}>
            <span className="mode-indicator-dot" />
            {mode === 'simulated' ? 'Simulation mode' : 'Real-time mode'}
          </div>
        </div>

        <div className="actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="mode-toggle" style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
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

          <div className="metric-card compact" style={{ padding: '10px 12px' }}>
            <span className="metric-label">Buses shown</span>
            <strong>{visibleBuses.length}</strong>
          </div>
          <div className="metric-card compact" style={{ padding: '10px 12px' }}>
            <span className="metric-label">Students on map</span>
            <strong>{visibleStudents.length}</strong>
          </div>
        </div>
      </div>

      <div
        className="panel"
        style={{
          position: 'absolute',
          top: '132px',
          right: '16px',
          zIndex: 20,
          width: 'min(360px, calc(100% - 32px))',
          padding: '16px',
          backdropFilter: 'blur(14px)',
          background: 'rgba(8, 13, 24, 0.78)',
          maxHeight: 'calc(100dvh - 260px)',
          overflow: 'auto',
        }}
      >
        <div className="panel-header">
          <h3 style={{ margin: 0 }}>Search for buses</h3>
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
            <button className="btn-primary" onClick={handleSearchBuses} disabled={searchLoading}>
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
            {searchResults && (
              <button className="btn-secondary" onClick={handleClearSearch}>
                Clear
              </button>
            )}
          </div>
        </div>

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

      <button
        type="button"
        onClick={handleLocateMe}
        className="primary"
        style={{
          position: 'absolute',
          right: '16px',
          bottom: '136px',
          zIndex: 25,
          borderRadius: '999px',
          padding: '12px 16px',
          boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
        }}
      >
        📍 Locate Me
      </button>

      <div
        className="panel"
        style={{
          position: 'absolute',
          left: '16px',
          right: '16px',
          bottom: '16px',
          zIndex: 30,
          minHeight: '120px',
          padding: '16px 18px',
          backdropFilter: 'blur(14px)',
          background: 'rgba(8, 13, 24, 0.9)',
          borderRadius: '20px',
        }}
      >
        <div className="panel-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0 }}>Bus details</h3>
            <p style={{ marginTop: '6px' }}>Select a bus to see details</p>
          </div>
          {selectedBus && (
            <button className="close-btn" type="button" onClick={() => setSelectedBusId('')}>
              ✕
            </button>
          )}
        </div>

        {selectedBusDetails ? (
          <div className="bus-details-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="bus-details-row">
              <span className="detail-label">Bus</span>
              <strong>{selectedBusDetails.title}</strong>
            </div>
            <div className="bus-details-row">
              <span className="detail-label">Route</span>
              <strong>{selectedBusDetails.route}</strong>
            </div>
            <div className="bus-details-row">
              <span className="detail-label">Current stop</span>
              <strong>{selectedBusDetails.stop}</strong>
            </div>
            <div className="bus-details-row">
              <span className="detail-label">Next stop</span>
              <strong>{selectedBusDetails.nextStop}</strong>
            </div>
            <div className="bus-details-row">
              <span className="detail-label">ETA</span>
              <strong>{selectedBusDetails.eta}</strong>
            </div>
            <div className="bus-details-row">
              <span className="detail-label">Speed</span>
              <strong>{Math.round(selectedBus?.speed || 0)} km/h</strong>
            </div>
          </div>
        ) : (
          <div className="panel-empty" style={{ minHeight: '56px' }}>
            Select a bus to see details
          </div>
        )}
      </div>
    </div>
  );
}
