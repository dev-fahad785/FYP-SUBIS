import { useEffect } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_CENTER = [29.3783, 71.7738];

function createBusIcon(simulated = false) {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-bus-marker ${simulated ? 'simulated' : ''}">
        <div class="transit-bus-ripple"></div>
        <div class="transit-bus-icon">
          <span>B</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

const busIcon = createBusIcon();
const simulatedBusIcon = createBusIcon(true);

function createStopIcon(color = '#3B82F6') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-stop-pin" style="--stop-color:${color};">
        <span class="transit-stop-pin-core"></span>
      </div>
    `,
    iconSize: [24, 32],
    iconAnchor: [12, 30],
  });
}

function createStudentDotIcon(color = '#22C55E') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `<div class="transit-student-dot" style="--marker-color:${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}



function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [map]);

  return null;
}

export default function TransitMap({
  routes = [],
  buses = [],
  students = [],
  center = DEFAULT_CENTER,
  zoom = 14,
  className = '',
  onBusSelect,
}) {
  return (
    <div className={`transit-map-shell ${className}`.trim()}>
      <MapContainer center={center} zoom={zoom} className="transit-map">
        <ResizeMap />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {/* Draw routes as colored polylines and stops */}
        {routes.map((route) => (
          <div key={route.id}>
            {Array.isArray(route.polyline) && route.polyline.length > 0 && (
              <Polyline
                positions={route.polyline}
                pathOptions={{ color: route.color, weight: 4, opacity: 0.85 }}
              />
            )}
            {(route.stops || []).map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.latitude, stop.longitude]}
                icon={createStopIcon(route.color)}
              >
                <Popup>
                  <strong>{stop.name}</strong>
                  <div>{route.name}</div>
                  <div>Order #{stop.order}</div>
                  {stop.crowdLevel && <div>Crowd: {stop.crowdLevel}</div>}
                </Popup>
              </Marker>
            ))}
          </div>
        ))}
        {/* Show buses, visually distinguish simulated */}
        {buses.map((bus) => (
          <Marker
            key={bus.id || bus.busId}
            position={[bus.latitude, bus.longitude]}
            icon={bus.simulated ? simulatedBusIcon : busIcon}
            eventHandlers={{
              click: () => {
                if (onBusSelect) {
                  onBusSelect(bus);
                }
              },
            }}
          >
            <Popup>
              <strong>{bus.plateNumber || bus.busId || bus.id}</strong>
              <div>Lat: {bus.latitude.toFixed(5)}, Lng: {bus.longitude.toFixed(5)}</div>
              {bus.routeName && <div>Route: {bus.routeName}</div>}
              {bus.currentStop && <div>Current stop: {bus.currentStop}</div>}
              {bus.nextStop && <div>Next stop: {bus.nextStop}</div>}
              {typeof bus.nextStopEtaMinutes === 'number' && (
                <div>ETA to next stop: {bus.nextStopEtaMinutes} min</div>
              )}
              {!bus.currentStop && bus.nearestStop && (
                <div>
                  Nearest stop: {bus.nearestStop}
                  {bus.nearestStopDistanceKm
                    ? ` (${bus.nearestStopDistanceKm} km)`
                    : ''}
                </div>
              )}
              {bus.simulated && <div style={{ color: '#F59E42' }}>Simulated</div>}
              {bus.lastUpdate && (
                <div>
                  Updated: {new Date(bus.lastUpdate).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </Popup>
          </Marker>
        ))}
        {/* Show student locations */}
        {students.map((student) => (
          <Marker
            key={student.userId}
            position={[student.latitude, student.longitude]}
            icon={createStudentDotIcon('#10B981')}
          >
            <Popup>
              <strong>{student.name || 'Student'}</strong>
              <div>{student.status === 'waiting' ? 'Waiting at stop' : 'Student device'}</div>
              <div>
                {student.latitude.toFixed(5)}, {student.longitude.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
