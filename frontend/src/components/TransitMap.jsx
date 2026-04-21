import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
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

const busIcon = L.divIcon({
  className: 'transit-icon-wrapper',
  html: `
    <div class="transit-bus-icon">
      <span>BUS</span>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function createStopIcon(color = '#3B82F6') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `<div class="transit-stop-icon" style="border-color:${color};"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function createUserIcon(label = 'You', color = '#22C55E') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-user-icon" style="--marker-color:${color};">
        <span>${label.slice(0, 1).toUpperCase()}</span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createSearchIcon() {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-search-icon">
        <span>◎</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

function ClickCapture({ onMapClick }) {
  useMapEvents({
    click(event) {
      if (onMapClick) {
        onMapClick(event.latlng);
      }
    },
  });

  return null;
}

export default function TransitMap({
  routes = [],
  buses = [],
  students = [],
  userLocation = null,
  center = DEFAULT_CENTER,
  zoom = 14,
  selectedPoint = null,
  searchResults = [],
  highlightedSearchResultId = '',
  onSearchResultSelect,
  onMapClick,
  showStops = true,
  showRoutes = true,
  className = '',
}) {
  return (
    <div className={`transit-map-shell ${className}`.trim()}>
      <MapContainer center={center} zoom={zoom} className="transit-map">
        <ResizeMap />
        <ClickCapture onMapClick={onMapClick} />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {showRoutes &&
          routes.map((route) => (
            <div key={route.id}>
              {Array.isArray(route.polyline) && route.polyline.length > 0 && (
                <Polyline
                  positions={route.polyline}
                  pathOptions={{
                    color: route.color || '#3B82F6',
                    weight: 4,
                    opacity: 0.85,
                  }}
                />
              )}

              {showStops &&
                (route.stops || []).map((stop) => (
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

        {buses.map((bus) => (
          <Marker key={bus.id || bus.busId} position={[bus.latitude, bus.longitude]} icon={busIcon}>
            <Popup>
              <strong>{bus.plateNumber || bus.busId || bus.id}</strong>
              <div>{bus.routeName || 'Route unavailable'}</div>
              <div>
                Speed:{' '}
                {typeof bus.speed === 'number' ? `${Number(bus.speed).toFixed(1)} km/h` : 'Unknown'}
              </div>
              {bus.probabilityScore && <div>Confidence: {bus.probabilityScore}%</div>}
              {bus.currentStop && <div>Current stop: {bus.currentStop}</div>}
              {bus.nextStop && <div>Next stop: {bus.nextStop}</div>}
              {typeof bus.nextStopEtaMinutes === 'number' && (
                <div>ETA to next stop: {bus.nextStopEtaMinutes} min</div>
              )}
              {bus.nearestStop && (
                <div>
                  Nearest stop: {bus.nearestStop}
                  {bus.nearestStopDistanceKm ? ` (${bus.nearestStopDistanceKm} km)` : ''}
                </div>
              )}
              {bus.lastUpdate && (
                <div>
                  Updated:{' '}
                  {new Date(bus.lastUpdate).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </Popup>
          </Marker>
        ))}

        {students.map((student) => (
          <Marker
            key={student.userId}
            position={[student.latitude, student.longitude]}
            icon={createUserIcon(student.name || 'S', '#F59E0B')}
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

        {userLocation && (
          <Marker position={userLocation} icon={createUserIcon('You')}>
            <Popup>Your location</Popup>
          </Marker>
        )}

        {selectedPoint && (
          <CircleMarker
            center={[selectedPoint.latitude, selectedPoint.longitude]}
            radius={10}
            pathOptions={{
              color: '#F97316',
              fillColor: '#FB923C',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              Selected point
              <div>
                {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
              </div>
            </Popup>
          </CircleMarker>
        )}

        {searchResults.map((result) => (
          <Marker
            key={result.id}
            position={[result.latitude, result.longitude]}
            icon={createSearchIcon()}
            eventHandlers={
              onSearchResultSelect
                ? {
                    click: () => onSearchResultSelect(result),
                  }
                : undefined
            }
          >
            <Popup>
              <strong>{result.label}</strong>
              <div>
                {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
              </div>
              {highlightedSearchResultId === result.id && <div>Selected search result</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
