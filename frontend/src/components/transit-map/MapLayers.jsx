import React from 'react';
import { Marker, Popup, Polyline } from 'react-leaflet';
import {
  busIcon,
  createStopIcon,
  createStudentDotIcon,
  highlightedBusIcon,
  highlightedSimulatedBusIcon,
  simulatedBusIcon,
} from './icons';

export function RouteLayers({ routes, hideRoutes, hideStops }) {
  return routes.map((route) => (
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
      {!hideStops &&
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
  ));
}

export function BusMarkers({ buses, highlightedBusIds, onBusSelect }) {
  return buses.map((bus) => {
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
            onBusSelect?.(bus);
          },
        }}
      >
        <Popup>
          <strong>{bus.plateNumber || bus.busId || bus.id}</strong>
          <div>
            Lat: {bus.latitude.toFixed(5)}, Lng: {bus.longitude.toFixed(5)}
          </div>
          {bus.routeName && <div>Route: {bus.routeName}</div>}
          {bus.currentStop && <div>Current stop: {bus.currentStop}</div>}
          {bus.nextStop && <div>Next stop: {bus.nextStop}</div>}
          {typeof bus.nextStopEtaMinutes === 'number' && (
            <div>ETA to next stop: {bus.nextStopEtaMinutes} min</div>
          )}
          {!bus.currentStop && bus.nearestStop && (
            <div>
              Nearest stop: {bus.nearestStop}
              {bus.nearestStopDistanceKm ? ` (${bus.nearestStopDistanceKm} km)` : ''}
            </div>
          )}
          {bus.simulated && <div style={{ color: '#F59E42' }}>Simulated</div>}
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
    );
  });
}

export function SearchResultMarkers({
  searchResults,
  highlightedSearchResultId,
  onSearchResultSelect,
}) {
  return searchResults.map((result) => (
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
  ));
}

export function SelectedPointMarker({ selectedPoint }) {
  if (!selectedPoint) {
    return null;
  }

  return (
    <Marker position={[selectedPoint.latitude, selectedPoint.longitude]}>
      <Popup>
        <strong>Selected point</strong>
        <div>
          {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
        </div>
      </Popup>
    </Marker>
  );
}

export function StudentMarkers({ students }) {
  return students.map((student) => (
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
  ));
}
