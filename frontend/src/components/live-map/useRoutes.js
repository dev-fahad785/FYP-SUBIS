import { useEffect, useMemo, useState } from 'react';
import { getRouteColor } from './utils';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function useRoutes() {
  const [routes, setRoutes] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE}/routes`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setRoutes(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => routes.map((route, index) => ({ ...route, color: getRouteColor(index) })),
    [routes],
  );
}
