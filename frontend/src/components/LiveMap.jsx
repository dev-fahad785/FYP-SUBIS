import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function LiveMap({ userName = 'Student' }) {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState({});
  const [students, setStudents] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [status, setStatus] = useState('Waiting for location permission...');
  const [mapCenter, setMapCenter] = useState([29.3783, 71.7738]);
  const [userId] = useState(() => `WEB_USER_${Math.floor(Math.random() * 100000)}`);
  const [mode, setMode] = useState('simulated'); // 'simulated' or 'real'

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
    });

    socket.on('students_snapshot', (snapshot) => {
      const nextStudents = {};
      for (const student of snapshot) {
        nextStudents[student.userId] = student;
      }
      setStudents(nextStudents);
    });

    socket.on('student_moved', (payload) => {
      setStudents((current) => ({ ...current, [payload.userId]: payload }));
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
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      socket.disconnect();
    };
  }, [userId, userName]);

  // Simulated data: 4-5 buses and some dummy students at stops
  const simulatedBuses = useMemo(
    () => Object.values(buses).filter((bus) => bus.isSimulated || bus.simulated).slice(0, 5),
    [buses]
  );
  const simulatedStudents = useMemo(() => {
    // Place 2-3 dummy students at each stop of the first route
    if (!routes[0] || !routes[0].stops) return [];
    return routes[0].stops.slice(0, 3).flatMap((stop, i) =>
      Array.from({ length: 2 + (i % 2) }, (_, j) => ({
        userId: `DUMMY_${i}_${j}`,
        name: `Dummy Student ${i + 1}-${j + 1}`,
        latitude: stop.latitude + 0.0001 * j,
        longitude: stop.longitude + 0.0001 * j,
        speed: 0,
        status: 'waiting',
      }))
    );
  }, [routes]);

  const demoBuses = useMemo(() => {
    const baseRoute = routes[0];
    const points = Array.isArray(baseRoute?.polyline) && baseRoute.polyline.length > 0
      ? baseRoute.polyline
      : baseRoute?.stops?.map((stop) => [stop.latitude, stop.longitude]) || [];

    if (points.length === 0) return [];

    return Array.from({ length: 5 }, (_, index) => {
      const point = points[(index * 3) % points.length];
      return {
        busId: `DEMO_BUS_${index + 1}`,
        latitude: point[0],
        longitude: point[1],
        speed: 22 + index * 3,
        simulated: true,
        routeName: baseRoute?.name || 'Demo Route',
        plateNumber: `SIM-${index + 1}`,
      };
    });
  }, [routes]);

  const realBuses = useMemo(
    () => Object.values(buses).filter((bus) => !bus.isSimulated && !bus.simulated),
    [buses]
  );
  const realStudents = useMemo(
    () => Object.values(students).filter((student) => !student.userId?.startsWith('DUMMY')),
    [students]
  );

  const visibleBuses = mode === 'simulated'
    ? (simulatedBuses.length > 0 ? simulatedBuses : demoBuses)
    : realBuses;
  const visibleStudents = mode === 'simulated' ? simulatedStudents : realStudents;

  return (
    <div className="student-map-layout">
      <div className="map-toolbar">
        <div>
          <div className="pill">Student View</div>
          <h3>Live bus map</h3>
          <p>{status}</p>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Buses shown</span>
          <strong>{visibleBuses.length}</strong>
        </div>
        <div className="metric-card compact">
          <span className="metric-label">Students on map</span>
          <strong>{visibleStudents.length}</strong>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className={mode === 'simulated' ? 'active' : ''}
            onClick={() => setMode('simulated')}
            style={{ marginRight: 8 }}
          >
            Simulated
          </button>
          <button
            className={mode === 'real' ? 'active' : ''}
            onClick={() => setMode('real')}
          >
            Real Time
          </button>
        </div>
      </div>

      <TransitMap
        routes={routes}
        buses={visibleBuses}
        students={visibleStudents}
        userLocation={userLocation}
        center={mapCenter}
      />
    </div>
  );
}
