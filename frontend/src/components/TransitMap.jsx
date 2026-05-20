import React from 'react';
import { useEffect } from 'react';
import {
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

function createBusIcon(simulated = false, highlighted = false) {
  const baseSize = highlighted ? 64 : 44;
  const innerSize = highlighted ? 40 : 24;
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-bus-marker ${simulated ? 'simulated' : ''} ${highlighted ? 'highlighted' : ''}">
        <div class="transit-bus-ripple"></div>
        <div class="transit-bus-icon" style="width: ${innerSize}px; height: ${innerSize}px; font-size: ${highlighted ? '20px' : '14px'};">
          <span>B</span>
        </div>
      </div>
    `,
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize / 2],
  });
}

const busIcon = createBusIcon();
const simulatedBusIcon = createBusIcon(true);
const highlightedBusIcon = createBusIcon(false, true);
const highlightedSimulatedBusIcon = createBusIcon(true, true);

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

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick?.(event.latlng);
    },
  });

  return null;
}

function FitMapToContent({ routes, buses, searchResults, selectedPoint, center, zoom, fitToBusesOnly = false }) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    if (!fitToBusesOnly) {
      routes.forEach((route) => {
        (route.stops || []).forEach((stop) => {
          points.push([stop.latitude, stop.longitude]);
        });

        if (Array.isArray(route.polyline)) {
          route.polyline.forEach((point) => {
            if (Array.isArray(point) && point.length === 2) {
              points.push(point);
            }
          });
        }
      });
    }

    buses.forEach((bus) => {
      if (typeof bus.latitude === 'number' && typeof bus.longitude === 'number') {
        points.push([bus.latitude, bus.longitude]);
      }
    });

    searchResults.forEach((result) => {
      points.push([result.latitude, result.longitude]);
    });

    if (
      selectedPoint &&
      typeof selectedPoint.latitude === 'number' &&
      typeof selectedPoint.longitude === 'number'
    ) {
      points.push([selectedPoint.latitude, selectedPoint.longitude]);
    }

    if (points.length > 1) {
      map.fitBounds(points, { padding: [32, 32] });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], Math.max(zoom, 15));
      return;
    }

    map.setView(center, zoom);
  }, [buses, center, fitToBusesOnly, map, routes, searchResults, selectedPoint, zoom]);

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
  highlightedBusIds = [],
  selectedPoint = null,
  searchResults = [],
  highlightedSearchResultId = '',
  onSearchResultSelect,
  onMapClick,
  hideRoutes = false,
  hideStops = false,
  fitToBusesOnly = false,
}) {
  return (
    <div className={`transit-map-shell ${className}`.trim()}>
      <MapContainer center={center} zoom={zoom} className="transit-map">
        <ResizeMap />
        <MapClickHandler onMapClick={onMapClick} />
        <FitMapToContent
          routes={routes}
          buses={buses}
          searchResults={searchResults}
          selectedPoint={selectedPoint}
          center={center}
          zoom={zoom}
          fitToBusesOnly={fitToBusesOnly}
        />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {/* Draw routes as colored polylines and stops */}
        {routes.map((route) => (
          <div key={route.id}>
            {!hideRoutes &&
              ((Array.isArray(route.polyline) && route.polyline.length > 0) ||
                (route.stops || []).length > 1) && (
                <Polyline
                  positions={
                    Array.isArray(route.polyline) && route.polyline.length > 0
                      ? route.polyline
                      : (route.stops || []).map((stop) => [stop.latitude, stop.longitude])
                  }
                  pathOptions={{ color: route.color || '#3B82F6', weight: 4, opacity: 0.85 }}
                />
              )}
            {!hideStops && (route.stops || []).map((stop) => (
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
        {buses.map((bus) => {
          const busId = bus.id || bus.busId;
          const isHighlighted = highlightedBusIds.includes(busId);
          let icon = busIcon;
          if (isHighlighted && bus.simulated) {
            icon = highlightedSimulatedBusIcon;
          } else if (isHighlighted) {
            icon = highlightedBusIcon;
          } else if (bus.simulated) {
            icon = simulatedBusIcon;
          }

          return (
            <Marker
              key={busId}
              position={[bus.latitude, bus.longitude]}
              icon={icon}
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
          );
        })}
        {searchResults.map((result) => (
          <Marker
            key={result.id}
            position={[result.latitude, result.longitude]}
            eventHandlers={{
              click: () => {
                onSearchResultSelect?.(result);
              },
            }}
            opacity={highlightedSearchResultId && highlightedSearchResultId !== result.id ? 0.65 : 1}
          >
            <Popup>
              <strong>{result.label}</strong>
              <div>
                {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        ))}
        {selectedPoint && (
          <Marker position={[selectedPoint.latitude, selectedPoint.longitude]}>
            <Popup>
              <strong>Selected point</strong>
              <div>
                {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        )}
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
