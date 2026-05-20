import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

export function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [map]);

  return null;
}

export function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick?.(event.latlng);
    },
  });

  return null;
}

export function FitMapToContent({
  routes,
  buses,
  searchResults,
  selectedPoint,
  center,
  zoom,
  fitToBusesOnly = false,
}) {
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
