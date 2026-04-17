import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

// Fix for default marker icons in React Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Bus Icon — red circle with bus emoji
const busIcon = L.divIcon({
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:38px;
        height:38px;
        border-radius:50%;
        background:#dc2626;
        border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:20px;
      ">🚌</div>
      <div style="
        margin-top:3px;
        background:#dc2626;
        color:white;
        font-size:10px;
        font-weight:700;
        padding:1px 6px;
        border-radius:8px;
        white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
      ">Bus</div>
    </div>
  `,
  className: '',
  iconSize: [38, 60],
  iconAnchor: [19, 60],
  popupAnchor: [0, -60],
});

// Custom Blue Stop Icon
const stopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [20, 32], // slightly smaller
  iconAnchor: [10, 32],
  popupAnchor: [1, -24],
  shadowSize: [32, 32]
});

// Function to get stop icon color based on route color
function getStopIconUrl(routeColor) {
  // Map route colors to leaflet marker colors
  const colorMap = {
    '#EF4444': 'red',       // Route 1 - Red
    '#3B82F6': 'blue',      // Route 2 - Blue
    '#10B981': 'green',     // Route 3 - Green
    '#F59E0B': 'orange',    // Route 4 - Amber
  };

  const markerColor = colorMap[routeColor] || 'blue'; // Default to blue if unknown color
  return `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`;
}

// Factory function to create stop icon with route color
function createStopIcon(routeColor) {
  return new L.Icon({
    iconUrl: getStopIconUrl(routeColor),
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [20, 32],
    iconAnchor: [10, 32],
    popupAnchor: [1, -24],
    shadowSize: [32, 32]
  });
}

// Factory to create a labeled divIcon: a colored circle avatar + name badge beneath
function createLabeledIcon(color, label, isSelf = false) {
  const size = isSelf ? 36 : 30;
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.45);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${isSelf ? 16 : 14}px;
      ">${isSelf ? '📍' : '🎓'}</div>
      <div style="
        margin-top:3px;
        background:${color};
        color:white;
        font-size:10px;
        font-weight:700;
        padding:1px 6px;
        border-radius:8px;
        white-space:nowrap;
        box-shadow:0 1px 4px rgba(0,0,0,0.35);
        max-width:80px;
        overflow:hidden;
        text-overflow:ellipsis;
      ">${label}</div>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size + 22],
    iconAnchor: [size / 2, size + 22],
    popupAnchor: [0, -(size + 22)],
  });
}

// Component to dynamically resize map when container size changes
function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

export default function LiveMap({ userName = 'You' }) {
  // Coordinates for Islamia University of Bahawalpur (Default/Fallback)
  const iubPosition = [29.3783, 71.7738];
  
  // State
  const [buses, setBuses] = useState({});
  const [routes, setRoutes] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);
  const [otherStudents, setOtherStudents] = useState({});
  const [useSimulated, setUseSimulated] = useState(false); // Toggle state
  // Generate a stable userId for this session to filter out our own broadcast
  const [myUserId] = useState(() => `WEB_USER_${Math.floor(Math.random() * 10000)}`);
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

  // Helper component to center map on user when location is found
  function MapCenterUpdater() {
    const map = useMap();
    useEffect(() => {
      if (userLocation && !hasCenteredOnUser) {
        map.setView(userLocation, 16);
        setHasCenteredOnUser(true);
      }
    }, [map, userLocation, hasCenteredOnUser]);
    return null;
  }

  // Fetch static route and stop data
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await axios.get(`${API_BASE}/routes`);
        setRoutes(response.data);
      } catch (error) {
        console.error('Failed to fetch routes', error);
      }
    };
    fetchRoutes();
  }, [API_BASE]);

  // Fetch simulated bus data (stub: replace with your own logic or endpoint)
  useEffect(() => {
    if (!useSimulated) return;
    let intervalId;
    const fetchSimulated = async () => {
      try {
        // Example: fetch from /simulator-data endpoint or static file
        const response = await axios.get(`${API_BASE}/simulator-data`);
        setBuses(response.data.buses || {});
        setOtherStudents(response.data.students || {});
      } catch (error) {
        // fallback: generate fake data
        setBuses({
          'SIM1': {
            busId: 'SIM1', latitude: 29.38, longitude: 71.77, speed: 30, lastUpdate: Date.now(), isSimulated: true
          }
        });
        setOtherStudents({});
      }
    };
    fetchSimulated();
    intervalId = setInterval(fetchSimulated, 3000); // update every 3s
    return () => clearInterval(intervalId);
  }, [useSimulated, API_BASE]);

  // Handle Real-Time Connection (only if not using simulated data)
  useEffect(() => {
    if (useSimulated) return;
    const socket = io(API_BASE);
    let watchId;

    socket.on('connect', () => {
      console.log('Connected to real-time bus server (Crowdsourced Tracking)');
    });

    // On connect, receive the snapshot of all currently active students
    socket.on('students_snapshot', (snapshot) => {
      console.log('Received students snapshot:', snapshot.length, 'students');
      const studentsMap = {};
      for (const student of snapshot) {
        if (student.userId !== myUserId) {
          studentsMap[student.userId] = student;
        }
      }
      setOtherStudents((prev) => ({ ...prev, ...studentsMap }));
    });

    // Start watching user location to crowdsource bus data
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed } = position.coords;
          // Native speed is in m/s, convert to km/h, default to 0. Fallback simulation values if tested on desktop.
          const speedKmh = speed ? (speed * 3.6) : (Math.random() * 20 + 10); 

          // Update local state for map marker
          setUserLocation([latitude, longitude]);

          socket.emit('update_location', {
            userId: myUserId, // stable per session
            name: userName,
            role: 'STUDENT',
            latitude,
            longitude,
            speed: speedKmh,
          });
          console.log('Emitted real-time student location for crowdsourcing:', latitude, longitude);
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }

    socket.on('bus_moved', (data) => {
      console.log('Crowdsourced Bus clustered event received:', data);
      setBuses((prevBuses) => ({
        ...prevBuses,
        [data.busId]: data,
      }));
    });

    // Listen for other students' locations — exclude our own broadcast
    socket.on('student_moved', (data) => {
      if (data.userId === myUserId) return; // don't show yourself twice
      setOtherStudents((prev) => ({
        ...prev,
        [data.userId]: data,
      }));
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from real-time bus server');
    });

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      socket.disconnect();
    };
  }, [API_BASE, useSimulated]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Toggle Button */}
      <div style={{ position: 'absolute', zIndex: 1000, top: 16, right: 16 }}>
        <button
          onClick={() => setUseSimulated((v) => !v)}
          style={{
            padding: '8px 16px',
            background: useSimulated ? '#2563eb' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
          }}
        >
          {useSimulated ? 'Show Real Data' : 'Show Simulated Data'}
        </button>
      </div>
      <MapContainer
        center={iubPosition}
        zoom={15}
        style={{ height: '100%', width: '100%', borderRadius: '8px' }}
      >
        <ResizeMap />
        <MapCenterUpdater />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* User's Current Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createLabeledIcon('#22c55e', userName, true)}>
            <Popup>
              <strong>📍 You ({userName})</strong>
            </Popup>
          </Marker>
        )}

        {/* OTHER STUDENTS (received via WebSocket or simulated) */}
        {Object.values(otherStudents)
          .filter(student => useSimulated || !student.isSimulated)
          .map((student) => (
            <Marker
              key={student.userId}
              position={[student.latitude, student.longitude]}
              icon={createLabeledIcon('#f59e0b', student.name || 'Student')}
            >
              <Popup>
                <strong>🎓 {student.name || 'Student'}</strong><br />
                Speed: {student.speed ? `${Number(student.speed).toFixed(1)} km/h` : 'Unknown'}<br />
                Last seen: {new Date(student.timestamp).toLocaleTimeString()}
              </Popup>
            </Marker>
        ))}

        {/* STATIC ROUTES & STOPS */}
        {routes.map((route) => (
          <div key={route.id}>
            {/* Draw Path */}
            {route.polyline && Array.isArray(route.polyline) && route.polyline.length > 0 && (
              <Polyline
                positions={route.polyline}
                pathOptions={{ color: route.color || '#3B82F6', weight: 4 }}
              />
            )}

            {/* Draw Stops */}
            {(route.stops || []).map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.latitude, stop.longitude]}
                icon={createStopIcon(route.color)}
              >
                <Popup>
                  <strong>{stop.name}</strong><br />
                  Route: {route.name}<br />
                  Stop Order: {stop.order}
                </Popup>
              </Marker>
            ))}
          </div>
        ))}

        {/* DYNAMIC BUS MARKERS (From Websocket or simulated) */}
        {Object.values(buses)
          .filter(bus => useSimulated || !bus.isSimulated)
          .map((bus) => (
            <Marker
              key={bus.busId}
              position={[bus.latitude, bus.longitude]}
              icon={busIcon}
            >
              <Popup>
                <strong>Bus ID: {bus.busId}</strong>
                {bus.isCrowdsourced && <span style={{ color: 'green', marginLeft: '8px', fontSize: '10px' }}>✓ Crowdsourced</span>}
                {bus.isSimulated && <span style={{ color: 'blue', marginLeft: '8px', fontSize: '10px' }}>🔄 Simulator</span>}
                <br />
                Speed: {bus.speed ? `${bus.speed.toFixed(1)} km/h` : 'Stopped'}<br />
                Last Update: {new Date(bus.lastUpdate).toLocaleTimeString()}

                {/* Current Stop Information */}
                {bus.currentStop && (
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #ddd', fontSize: '12px' }}>
                    <strong>📍 Current Stop:</strong> {bus.currentStop}
                  </div>
                )}

                {/* Next Stop Information */}
                {bus.nextStop && (
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    <strong>➡️ Next Stop:</strong> {bus.nextStop}
                  </div>
                )}

                {bus.etas && bus.etas.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
                    <strong>Next Stops ETA:</strong>
                    <ul style={{ paddingLeft: '20px', margin: '4px 0 0 0', fontSize: '11px' }}>
                      {bus.etas.slice(0, 3).map((eta) => ( // Show next 3 stops to save space
                        <li key={eta.stopId}>
                          {eta.stopName}: <strong>~{eta.estimatedMinutes} mins</strong> ({eta.distanceKm} km)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Popup>
            </Marker>
        ))}

      </MapContainer>
    </div>
  );
}
