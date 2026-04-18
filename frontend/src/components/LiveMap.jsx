import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function LiveMap({ userName = 'Student' }) {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [status, setStatus] = useState('Waiting for location permission...');
  const [mapCenter, setMapCenter] = useState([29.3783, 71.7738]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [userId] = useState(() => `WEB_USER_${Math.floor(Math.random() * 100000)}`);

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

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    socket.on('bus_moved', (payload) => {
      setBuses((current) => ({
        ...current,
        [payload.busId]: payload,
      }));
      setStatus('Live bus updates connected.');
    });

    socket.on('buses_snapshot', (snapshot) => {
      const nextBuses = {};
      for (const bus of snapshot) {
        nextBuses[bus.busId] = bus;
      }
      setBuses(nextBuses);
      if (snapshot.length > 0) {
        setStatus('Loaded active buses from live snapshot.');
      }
    });

    socket.on('connect_error', () => {
      setStatus('Live bus updates unavailable.');
    });

    let watchId;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation = [position.coords.latitude, position.coords.longitude];
          setUserLocation(nextLocation);
          setMapCenter(nextLocation);
          setStatus('Sharing your location with the live map.');

          socket.emit('update_location', {
            userId,
            name: userName,
            role: 'STUDENT',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            speed: position.coords.speed ? position.coords.speed * 3.6 : 0,
          });
        },
        () => {
          setStatus('Location permission denied. Showing campus overview.');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
        }
      );
    } else {
      // setStatus('Geolocation is not supported in this browser.');
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      socket.disconnect();
    };
  }, [userId, userName]);

  const busList = useMemo(() => Object.values(buses), [buses]);
  const filteredBuses = useMemo(
    () => busList.filter((bus) => !selectedRouteId || bus.routeId === selectedRouteId),
    [busList, selectedRouteId]
  );
  const filteredRoutes = useMemo(
    () => routes.filter((route) => !selectedRouteId || route.id === selectedRouteId),
    [routes, selectedRouteId]
  );

  return (
    <div className="student-map-layout">
      <div className="map-toolbar">
        <div>
          <div className="pill">Student View</div>
          <h3>Live bus map</h3>
          <p>{status}</p>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Tracked buses</span>
          <strong>{filteredBuses.length}</strong>
        </div>
      </div>

      <div className="student-layout-grid">
        <div className="student-side-panel">
          <label className="field">
            <span>Route filter</span>
            <select
              value={selectedRouteId}
              onChange={(event) => setSelectedRouteId(event.target.value)}
            >
              <option value="">All routes</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name}
                </option>
              ))}
            </select>
          </label>

          <div className="bus-insights-list">
            {filteredBuses.length === 0 && <div className="panel-empty">No active buses yet.</div>}
            {filteredBuses.map((bus) => (
              <article key={bus.busId} className="bus-insight-card">
                <strong>{bus.routeName || bus.plateNumber || bus.busId}</strong>
                <p>
                  Speed:{' '}
                  {typeof bus.speed === 'number' ? `${Number(bus.speed).toFixed(1)} km/h` : 'Unknown'}
                </p>
                {bus.currentStop && <p>Current stop: {bus.currentStop}</p>}
                {bus.nextStop && <p>Next stop: {bus.nextStop}</p>}
                {typeof bus.nextStopEtaMinutes === 'number' && (
                  <p>ETA to next stop: {bus.nextStopEtaMinutes} min</p>
                )}
                {bus.probabilityScore && (
                  <p>
                    Cluster confidence: {bus.probabilityScore}%{bus.probabilityLabel ? ` · ${bus.probabilityLabel}` : ''}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <TransitMap
          routes={filteredRoutes}
          buses={filteredBuses}
          userLocation={userLocation}
          center={mapCenter}
        />
      </div>
    </div>
  );
}
