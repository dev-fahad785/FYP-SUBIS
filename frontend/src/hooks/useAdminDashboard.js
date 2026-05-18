import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function useAdminDashboard(authToken) {
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [analyticsRange, setAnalyticsRange] = useState('daily');
  const [analytics, setAnalytics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsPagination, setLogsPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [logSource, setLogSource] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeForm, setRouteForm] = useState({ name: '', color: '#3B82F6' });
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState([]);
  const [selectedLocationResultId, setSelectedLocationResultId] = useState('');
  const [stopForm, setStopForm] = useState({
    routeId: '',
    stopId: '',
    name: '',
    latitude: '',
    longitude: '',
    order: '',
  });
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [loadingState, setLoadingState] = useState({
    overview: true,
    analytics: true,
    logs: true,
    geocoding: false,
    saving: false,
  });

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    }),
    [authToken]
  );

  const loadOverview = useCallback(async () => {
    setLoadingState((state) => ({ ...state, overview: true }));
    try {
      const response = await fetch(`${API_BASE}/admin/overview`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load overview');
      }

      setOverview(data);
      setSelectedRouteId((current) => current || data.routes?.[0]?.id || '');
      setStopForm((current) => ({
        ...current,
        routeId: current.routeId || data.routes?.[0]?.id || '',
      }));
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, overview: false }));
    }
  }, [authHeaders]);

  const loadAnalytics = useCallback(async (range = analyticsRange) => {
    setLoadingState((state) => ({ ...state, analytics: true }));
    try {
      const response = await fetch(`${API_BASE}/admin/analytics?range=${range}`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load analytics');
      }

      setAnalytics(data);
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, analytics: false }));
    }
  }, [authHeaders, analyticsRange]);

  const loadLogs = useCallback(async (page = 1, source = logSource) => {
    setLoadingState((state) => ({ ...state, logs: true }));
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: '10',
      });

      if (source) {
        query.set('source', source);
      }

      const response = await fetch(`${API_BASE}/admin/logs?${query.toString()}`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load telemetry logs');
      }

      setLogs(data.items || []);
      setLogsPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, logs: false }));
    }
  }, [authHeaders, logSource]);

  useEffect(() => {
    loadOverview();
    loadAnalytics();
    loadLogs();
  }, [loadOverview, loadAnalytics, loadLogs]);

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
    });

    socket.on('bus_moved', (payload) => {
      setOverview((current) => {
        if (!current) {
          return current;
        }

        const nextBuses = [...(current.buses || [])];
        const routeName =
          current.routes?.find((route) => route.id === payload.routeId)?.name || 'Active route';
        const index = nextBuses.findIndex(
          (bus) => bus.id === payload.busId || bus.busId === payload.busId
        );
        const nextBus = {
          id: payload.busId,
          busId: payload.busId,
          plateNumber: payload.busId,
          latitude: payload.latitude,
          longitude: payload.longitude,
          speed: payload.speed,
          lastUpdate: payload.lastUpdate,
          crowdLevel: payload.crowdLevel,
          routeId: payload.routeId,
          routeName,
        };

        if (index >= 0) {
          nextBuses[index] = {
            ...nextBuses[index],
            ...nextBus,
          };
        } else {
          nextBuses.push(nextBus);
        }

        return {
          ...current,
          buses: nextBuses,
        };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const routeOptions = useMemo(() => overview?.routes || [], [overview?.routes]);

  const selectedRoute = useMemo(
    () => routeOptions.find((route) => route.id === selectedRouteId) || routeOptions[0] || null,
    [routeOptions, selectedRouteId]
  );

  const allStops = useMemo(
    () =>
      routeOptions.flatMap((route) =>
        (route.stops || []).map((stop) => ({
          ...stop,
          routeId: route.id,
          routeName: route.name,
        }))
      ),
    [routeOptions]
  );

  const clearStopForm = useCallback(() => {
    setStopForm((current) => ({
      ...current,
      stopId: '',
      name: '',
      latitude: '',
      longitude: '',
      order: '',
    }));
    setSelectedPoint(null);
    setLocationResults([]);
    setSelectedLocationResultId('');
  }, []);

  const handleRouteCreate = useCallback(async (event) => {
    event.preventDefault();
    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    try {
      const createResponse = await fetch(`${API_BASE}/routes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: routeForm.name }),
      });
      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.message || 'Failed to create route');
      }

      if (routeForm.color && routeForm.color !== '#3B82F6') {
        const updateResponse = await fetch(`${API_BASE}/routes/${createData.id}`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ color: routeForm.color }),
        });
        if (!updateResponse.ok) {
          const updateData = await updateResponse.json();
          throw new Error(updateData.message || 'Route created but color update failed');
        }
      }

      setRouteForm({ name: '', color: '#3B82F6' });
      setFeedback({ type: 'success', message: 'Route created successfully.' });
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  }, [authHeaders, loadOverview, routeForm.color, routeForm.name]);

  const handleRouteUpdate = useCallback(async (routeId, payload) => {
    if (!routeId) {
      setFeedback({ type: 'error', message: 'Select a route to update.' });
      return false;
    }

    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(`${API_BASE}/routes/${routeId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update route');
      }

      setFeedback({ type: 'success', message: 'Route updated successfully.' });
      await loadOverview();
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      return false;
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  }, [authHeaders, loadOverview]);

  const handleStopSubmit = useCallback(async (event) => {
    event.preventDefault();
    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    const payload = {
      name: stopForm.name,
      latitude: Number(stopForm.latitude),
      longitude: Number(stopForm.longitude),
      order: Number(stopForm.order),
    };

    try {
      const endpoint = stopForm.stopId
        ? `${API_BASE}/routes/stops/${stopForm.stopId}`
        : `${API_BASE}/routes/${stopForm.routeId}/stops`;
      const method = stopForm.stopId ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save stop');
      }

      setFeedback({
        type: 'success',
        message: stopForm.stopId ? 'Stop updated successfully.' : 'Stop added successfully.',
      });
      clearStopForm();
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  }, [authHeaders, clearStopForm, loadOverview, stopForm]);

  const handleRouteDelete = useCallback(async (routeToDelete = selectedRoute) => {
    if (!routeToDelete?.id) {
      setFeedback({ type: 'error', message: 'Select a route to delete.' });
      return;
    }

    const confirmed = window.confirm(
      `Delete route "${routeToDelete.name}"? This will also remove its stops and linked bus data.`
    );

    if (!confirmed) {
      return;
    }

    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(`${API_BASE}/routes/${routeToDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete route');
      }

      setSelectedRouteId((current) => (current === routeToDelete.id ? '' : current));
      setStopForm((current) => ({
        ...current,
        routeId: current.routeId === routeToDelete.id ? '' : current.routeId,
      }));
      clearStopForm();
      setLocationQuery('');
      setFeedback({ type: 'success', message: 'Route deleted successfully.' });
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  }, [authHeaders, clearStopForm, loadOverview, selectedRoute]);

  const handleStopDelete = useCallback(async () => {
    if (!stopForm.stopId) {
      setFeedback({ type: 'error', message: 'Select a stop to delete.' });
      return;
    }

    const confirmed = window.confirm(`Delete stop "${stopForm.name}" from this route?`);

    if (!confirmed) {
      return;
    }

    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(`${API_BASE}/routes/stops/${stopForm.stopId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete stop');
      }

      clearStopForm();
      setLocationQuery('');
      setFeedback({ type: 'success', message: 'Stop deleted successfully.' });
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  }, [authHeaders, clearStopForm, loadOverview, stopForm.name, stopForm.stopId]);

  const handleLocationSearch = useCallback(async (event) => {
    event?.preventDefault?.();

    if (!locationQuery.trim()) {
      setFeedback({ type: 'error', message: 'Enter a place name before searching.' });
      return;
    }

    setLoadingState((state) => ({ ...state, geocoding: true }));
    setFeedback({ type: '', message: '' });

    try {
      const query = new URLSearchParams({
        query: locationQuery.trim(),
      });
      const response = await fetch(`${API_BASE}/admin/geocode?${query.toString()}`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to search location');
      }

      setLocationResults(data.results || []);
      setSelectedLocationResultId(data.results?.[0]?.id || '');

      if (!data.results?.length) {
        setFeedback({ type: 'error', message: 'No matching locations found.' });
      } else {
        setSelectedPoint({
          latitude: data.results[0].latitude,
          longitude: data.results[0].longitude,
        });
        setFeedback({
          type: 'success',
          message: 'Search results loaded. Click a marker on the map or a result below to use it.',
        });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, geocoding: false }));
    }
  }, [authHeaders, locationQuery]);

  const applyLocationResult = useCallback((result) => {
    setSelectedLocationResultId(result.id);
    setSelectedPoint({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setStopForm((current) => ({
      ...current,
      latitude: result.latitude.toFixed(6),
      longitude: result.longitude.toFixed(6),
      name: current.name || result.label.split(',')[0],
    }));
    setLocationQuery(result.label);
    setFeedback({ type: 'success', message: 'Coordinates filled from location search.' });
  }, []);

  const populateStopForm = useCallback((stop) => {
    if (!stop) {
      return;
    }

    setSelectedRouteId(stop.routeId);
    setStopForm({
      routeId: stop.routeId,
      stopId: stop.id,
      name: stop.name,
      latitude: String(stop.latitude),
      longitude: String(stop.longitude),
      order: String(stop.order),
    });
    setSelectedPoint({
      latitude: stop.latitude,
      longitude: stop.longitude,
    });
    setLocationQuery(stop.name);
    setLocationResults([]);
    setSelectedLocationResultId('');
    setActiveTab('routes');
  }, []);

  const handleMapSelect = useCallback((latlng) => {
    setSelectedPoint({
      latitude: latlng.lat,
      longitude: latlng.lng,
    });
    setStopForm((current) => ({
      ...current,
      latitude: latlng.lat.toFixed(6),
      longitude: latlng.lng.toFixed(6),
    }));
  }, []);

  const handleRouteSelect = useCallback((routeId) => {
    setSelectedRouteId(routeId);
    setStopForm((current) => ({ ...current, routeId }));
  }, []);

  const handleAnalyticsRangeChange = useCallback((range) => {
    setAnalyticsRange(range);
    loadAnalytics(range);
  }, [loadAnalytics]);

  const handleLogSourceChange = useCallback((source) => {
    setLogSource(source);
    loadLogs(1, source);
  }, [loadLogs]);

  return {
    activeTab,
    setActiveTab,
    overview,
    analyticsRange,
    analytics,
    logs,
    logsPagination,
    logSource,
    selectedRouteId,
    routeForm,
    setRouteForm,
    locationQuery,
    setLocationQuery,
    locationResults,
    selectedLocationResultId,
    stopForm,
    setStopForm,
    selectedPoint,
    feedback,
    loadingState,
    routeOptions,
    selectedRoute,
    allStops,
    overviewMapRoutes: overview?.routes || [],
    overviewMapBuses: overview?.buses || [],
    selectedRouteMap: selectedRoute ? [selectedRoute] : [],
    loadOverview,
    loadLogs,
    handleRouteCreate,
    handleRouteUpdate,
    handleStopSubmit,
    handleRouteDelete,
    handleStopDelete,
    handleLocationSearch,
    applyLocationResult,
    populateStopForm,
    handleMapSelect,
    handleRouteSelect,
    clearStopForm,
    handleAnalyticsRangeChange,
    handleLogSourceChange,
  };
}
