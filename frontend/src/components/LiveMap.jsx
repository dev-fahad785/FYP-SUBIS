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
          <strong>{busList.length}</strong>
        </div>
      </div>

      <TransitMap routes={routes} buses={busList} userLocation={userLocation} center={mapCenter} />
    </div>
  );
}
