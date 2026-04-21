import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function getRouteColor(index) {
  const palette = ['#3B82F6', '#F59E42', '#10B981', '#F43F5E', '#A78BFA', '#FBBF24', '#6366F1'];
  return palette[index % palette.length];
}

export default function LiveMap() {
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState({});
  const [students, setStudents] = useState({});
  const [status, setStatus] = useState('Connecting to live bus updates...');
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
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socket.on('bus_moved', (payload) => {
      // Map isSimulated to simulated for frontend filtering
      const mapped = { ...payload, simulated: payload.simulated ?? payload.isSimulated };
      setBuses((current) => ({ ...current, [payload.busId]: mapped }));
      setStatus('Live bus updates connected.');
    });
    socket.on('buses_snapshot', (snapshot) => {
      const nextBuses = {};
      for (const bus of snapshot) {
        const mapped = { ...bus, simulated: bus.simulated ?? bus.isSimulated };
        nextBuses[bus.busId] = mapped;
      }
      setBuses(nextBuses);
      if (snapshot.length > 0) {
        setStatus('Loaded active buses from live snapshot.');
      }
    });
    socket.on('students_snapshot', (snapshot) => {
      const waitingStudents = {};
      for (const student of snapshot) {
        if (student.speed > 10) continue;
        waitingStudents[student.userId] = student;
      }
      setStudents(waitingStudents);
    });
    socket.on('student_moved', (payload) => {
      if (payload.speed > 10) {
        setStudents((current) => {
          const next = { ...current };
          delete next[payload.userId];
          return next;
        });
        return;
      }
      setStudents((current) => ({ ...current, [payload.userId]: payload }));
    });
    socket.on('connect_error', () => {
      setStatus('Live bus updates unavailable.');
    });
    return () => { socket.disconnect(); };
  }, []);

  // Separate simulated and real buses, limit simulated to 3
  const busList = useMemo(() => Object.values(buses), [buses]);
  const simulatedBuses = busList.filter((b) => b.simulated).slice(0, 3);
  const realBuses = busList.filter((b) => !b.simulated);

  // Assign colors to routes
  const routesWithColor = useMemo(() => routes.map((r, i) => ({ ...r, color: getRouteColor(i) })), [routes]);

  // Select buses based on mode
  const visibleBuses = mode === 'simulated' ? simulatedBuses : realBuses;
  const visibleStudents = Object.values(students);

  return (
    <div className="student-map-layout">
      <div className="map-toolbar">
        <div>
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
        <div style={{marginLeft: 'auto'}}>
          <button
            className={mode === 'simulated' ? 'active' : ''}
            onClick={() => setMode('simulated')}
            style={{marginRight: 8}}
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
      <div className="student-layout-grid">
        <TransitMap
          routes={routesWithColor}
          buses={visibleBuses}
          students={visibleStudents}
        />
      </div>
    </div>
  );
}
