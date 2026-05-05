import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function useSocketData(userId, userName) {
  const socketRef = useRef(null);
  const [buses, setBuses] = useState({});
  const [students, setStudents] = useState({});
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertFeed, setAlertFeed] = useState([]);
  const [status, setStatus] = useState('Connecting to live bus updates...');

  useEffect(() => {
    const socket = io(API_BASE, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let watchId = null;

    const emitStudentLocation = (position) => {
      if (!userId) return;
      const speedKmh = Math.max(0, (position.coords.speed ?? 0) * 3.6);
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
        () => setStatus('Location access denied or unavailable.'),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
      );
    };

    socket.on('connect', beginLocationTracking);

    socket.on('bus_moved', (payload) => {
      const mapped = { ...payload, simulated: payload.simulated ?? payload.isSimulated };
      setBuses((c) => ({ ...c, [payload.busId]: mapped }));
      setStatus('Live bus updates connected.');
    });

    socket.on('buses_snapshot', (snapshot) => {
      const nextBuses = {};
      for (const bus of snapshot) {
        nextBuses[bus.busId] = { ...bus, simulated: bus.simulated ?? bus.isSimulated };
      }
      setBuses(nextBuses);
      if (snapshot.length > 0) setStatus('Loaded active buses from live snapshot.');
    });

    socket.on('student_alerts_snapshot', (snapshot) => {
      setActiveAlerts(Array.isArray(snapshot) ? snapshot : []);
    });

    socket.on('student_alert_triggered', (payload) => {
      setActiveAlerts((current) =>
        current.map((alert) =>
          alert.id === payload.alert.id
            ? { ...alert, triggeredBusIds: [...(alert.triggeredBusIds || []), payload.bus.busId] }
            : alert,
        ),
      );
      setAlertFeed((current) =>
        [{ ...payload, triggeredAt: new Date().toISOString() }, ...current].slice(0, 3),
      );
      setStatus(payload.message || 'A bus alert was triggered.');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SUBIS bus alert', {
          body: `${payload.message} ETA to your start stop: ${payload.etaMinutes ?? 'unknown'} min.`,
        });
      }
    });

    socket.on('students_snapshot', (snapshot) => {
      const nextStudents = {};
      for (const s of snapshot) {
        nextStudents[s.userId] = { ...s, isSimulated: Boolean(s.isSimulated) };
      }
      setStudents(nextStudents);
    });

    socket.on('student_moved', (payload) => {
      setStudents((c) => ({
        ...c,
        [payload.userId]: { ...payload, isSimulated: Boolean(payload.isSimulated) },
      }));
    });

    socket.on('student_removed', (payload) => {
      setStudents((c) => {
        const next = { ...c };
        delete next[payload.userId];
        return next;
      });
    });

    socket.on('connect_error', () => setStatus('Live bus updates unavailable.'));

    return () => {
      socketRef.current = null;
      if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
      socket.disconnect();
    };
  }, [userId, userName]);

  const clearAlert = (alertId) => {
    socketRef.current?.emit('clear_student_alert', { alertId });
    setActiveAlerts((c) => c.filter((a) => a.id !== alertId));
  };

  return { buses, students, activeAlerts, alertFeed, status, clearAlert };
}
