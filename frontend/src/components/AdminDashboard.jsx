import React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const tabLabels = {
  overview: 'Operations Overview',
  routes: 'Route Manager',
  analytics: 'Analytics',
};

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

function BarChart({ points = [] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,_minmax(28px,_1fr))] items-end gap-2.5 min-h-64 p-4 rounded-lg bg-white/3">
      {points.map((point) => (
        <div key={point.label} className="grid gap-2 justify-items-center h-full">
          <div
            className="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400"
            style={{ height: `${Math.max((point.total / maxValue) * 100, point.total ? 12 : 4)}%` }}
            title={`${point.label}: ${point.total}`}
          />
          <span className="text-xs text-slate-400">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard({ authToken, currentUserName, onLogout }) {
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

  const selectedRoute = useMemo(
    () => overview?.routes?.find((route) => route.id === selectedRouteId) || overview?.routes?.[0] || null,
    [overview, selectedRouteId]
  );

  const routeOptions = useMemo(() => overview?.routes || [], [overview?.routes]);
  const overviewMapRoutes = overview?.routes || [];
  const overviewMapBuses = overview?.buses || [];
  const selectedRouteMap = selectedRoute ? [selectedRoute] : [];

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

  const handleRouteCreate = async (event) => {
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
  };

  const handleStopSubmit = async (event) => {
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
      setStopForm((current) => ({
        ...current,
        stopId: '',
        name: '',
        latitude: '',
        longitude: '',
        order: '',
      }));
      setSelectedPoint(null);
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  };
  
  const handleRouteDelete = async () => {
    if (!selectedRoute?.id) {
      setFeedback({ type: 'error', message: 'Select a route to delete.' });
      return;
    }

    const confirmed = window.confirm(
      `Delete route "${selectedRoute.name}"? This will also remove its stops and linked bus data.`
    );

    if (!confirmed) {
      return;
    }

    setLoadingState((state) => ({ ...state, saving: true }));
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(`${API_BASE}/routes/${selectedRoute.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await parseJsonResponse(response);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete route');
      }

      setSelectedRouteId('');
      setStopForm((current) => ({
        ...current,
        routeId: '',
        stopId: '',
        name: '',
        latitude: '',
        longitude: '',
        order: '',
      }));
      setSelectedPoint(null);
      setLocationResults([]);
      setSelectedLocationResultId('');
      setFeedback({ type: 'success', message: 'Route deleted successfully.' });
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  };

  const handleStopDelete = async () => {
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
        throw new Error(data.message || 'Failed to delete stop');
      }

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
      setFeedback({ type: 'success', message: 'Stop deleted successfully.' });
      await loadOverview();
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setLoadingState((state) => ({ ...state, saving: false }));
    }
  };

  const handleLocationSearch = async (event) => {
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
  };

  const applyLocationResult = (result) => {
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
  };

  const populateStopForm = (stop) => {
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
  };

  const handleMapSelect = (latlng) => {
    setSelectedPoint({
      latitude: latlng.lat,
      longitude: latlng.lng,
    });
    setStopForm((current) => ({
      ...current,
      latitude: latlng.lat.toFixed(6),
      longitude: latlng.lng.toFixed(6),
    }));
  };

  return (
    <div className="grid gap-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="text-blue-400 text-xs uppercase tracking-widest font-bold">SUBIS · Admin Console</p>
          <h2 className="text-3xl font-bold text-white mt-2">Welcome back, {currentUserName || 'Admin'}</h2>
          <p className="text-slate-300 text-base max-w-3xl leading-relaxed mt-2">
            Monitor fleet activity, review telemetry, and keep route data current from a single workspace.
          </p>
        </div>
        <button className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white font-bold hover:bg-white/10 transition transform hover:-translate-y-0.5" type="button" onClick={onLogout}>
          Log out
        </button>
      </div>

      {feedback.message && (
        <div className={`rounded-lg p-3 font-semibold text-sm border ${
          feedback.type === 'error' 
            ? 'bg-red-500/15 border-red-500/35 text-red-200' 
            : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
        }`}>
          {feedback.message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-4 py-2 font-bold text-sm transition transform hover:-translate-y-0.5 ${
              activeTab === key
                ? 'bg-blue-500/20 border border-blue-500/45 text-blue-100'
                : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
            }`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="grid gap-4">
          <div className="grid grid-cols-4 gap-3">
            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Active buses</span>
              <strong className="text-3xl text-white">{overview?.summary?.activeBusCount ?? '--'}</strong>
            </article>
            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Active routes</span>
              <strong className="text-3xl text-white">{overview?.summary?.routeCount ?? '--'}</strong>
            </article>
            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Configured stops</span>
              <strong className="text-3xl text-white">{overview?.summary?.stopCount ?? '--'}</strong>
            </article>
            <article className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Telemetry records</span>
              <strong className="text-3xl text-white">{overview?.summary?.telemetryCount ?? '--'}</strong>
            </article>
          </div>

          <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 min-h-96 flex flex-col">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Operations map</h3>
                  <p className="text-slate-400 text-sm">All active buses and campus routes in a single live view.</p>
                </div>
                <button className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition" type="button" onClick={loadOverview}>
                  Refresh
                </button>
              </div>

              {loadingState.overview ? (
                <div className="flex-1 grid place-items-center text-center text-slate-400">Loading live fleet overview...</div>
              ) : (
                <div className="flex-1 rounded-lg overflow-hidden border border-white/10 bg-slate-950/50">
                  <TransitMap routes={overviewMapRoutes} buses={overviewMapBuses} />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
              <div>
                <h3 className="text-lg font-bold text-white">Active alerts</h3>
                <p className="text-slate-400 text-sm">Stale bus pings and crowd conditions needing attention.</p>
              </div>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {(overview?.alerts || []).length === 0 && <div className="text-center py-8 text-slate-400">No active alerts.</div>}
                {(overview?.alerts || []).map((alert, index) => (
                  <article key={`${alert.type}-${index}`} className={`rounded-lg p-3 border ${
                    alert.severity === 'high' 
                      ? 'border-red-500/35 bg-red-500/10' 
                      : 'border-amber-500/35 bg-amber-500/10'
                  }`}>
                    <strong className="text-white text-sm">{alert.title}</strong>
                    <p className={`text-sm mt-1 ${alert.severity === 'high' ? 'text-red-200' : 'text-amber-200'}`}>{alert.description}</p>
                  </article>
                ))}
              </div>

              <div className="pt-2 border-t border-white/10 grid gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white">Crowded stops</h3>
                  <p className="text-slate-400 text-xs">Jump straight into route editing from the hotspots list.</p>
                </div>
                <div className="grid gap-2">
                  {(overview?.crowdStops || []).map((stop) => {
                    const fullStop = allStops.find((item) => item.id === stop.id);
                    return (
                      <button
                        type="button"
                        key={stop.id}
                        className="rounded-lg p-3 border border-white/10 bg-white/5 text-left hover:bg-white/10 transition text-sm"
                        onClick={() => populateStopForm(fullStop)}
                      >
                        <span className="text-white block font-bold">{stop.name}</span>
                        <strong className="text-blue-300 text-xs block">{stop.routeName}</strong>
                        <em className="text-slate-400 text-xs block">{stop.crowdLevel}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'routes' && (
        <section className="grid gap-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
              <div>
                <h3 className="text-lg font-bold text-white">Route manager</h3>
                <p className="text-slate-400 text-sm">Create routes, update route details, and adjust stop coordinates.</p>
              </div>

              <form className="grid gap-3" onSubmit={handleRouteCreate}>
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-xs font-bold uppercase">Route name</span>
                    <input
                      type="text"
                      value={routeForm.name}
                      onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Blue Line"
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-xs font-bold uppercase">Color</span>
                    <input
                      type="color"
                      value={routeForm.color}
                      onChange={(event) => setRouteForm((current) => ({ ...current, color: event.target.value }))}
                      className="rounded-lg h-10 cursor-pointer"
                    />
                  </label>
                </div>
                <button className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition" type="submit" disabled={loadingState.saving}>
                  {loadingState.saving ? 'Saving…' : 'Create route'}
                </button>
              </form>

              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {routeOptions.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    className={`flex items-center gap-3 rounded-lg p-3 text-left transition ${
                      selectedRouteId === route.id
                        ? 'bg-blue-500/20 border border-blue-500/45'
                        : 'border border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setSelectedRouteId(route.id);
                      setStopForm((current) => ({ ...current, routeId: route.id }));
                    }}
                  >
                    <span className="w-3 h-10 rounded-full" style={{ backgroundColor: route.color || '#3B82F6' }} />
                    <div className="flex-1 min-w-0">
                      <strong className="text-white text-sm block">{route.name}</strong>
                      <p className="text-slate-400 text-xs">{route.stops?.length || 0} stops</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-white/10 bg-white/5 p-4 grid gap-4">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedRoute?.name || 'Select a route'}</h3>
                    <p className="text-slate-400 text-xs mt-1">Click the map to fill latitude and longitude for a stop.</p>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg text-red-200 border border-red-500/45 bg-red-500/12 text-xs font-bold hover:bg-red-500/18 transition disabled:opacity-50"
                    type="button"
                    onClick={handleRouteDelete}
                    disabled={loadingState.saving || !selectedRoute?.id}
                  >
                    Delete route
                  </button>
                </div>

                <form className="grid gap-3" onSubmit={handleStopSubmit}>
                  <label className="grid gap-1.5">
                    <span className="text-slate-300 text-xs font-bold uppercase">Route</span>
                    <select
                      value={stopForm.routeId}
                      onChange={(event) =>
                        setStopForm((current) => ({ ...current, routeId: event.target.value }))
                      }
                      className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                    >
                      {routeOptions.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-lg border border-white/10 bg-white/3 p-3 grid gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white">Search location</h3>
                      <p className="text-slate-400 text-xs mt-1">Find a place name and use its coordinates for this stop.</p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={locationQuery}
                        onChange={(event) => setLocationQuery(event.target.value)}
                        placeholder="Search campus gate, department, street, or landmark"
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleLocationSearch(event);
                          }
                        }}
                      />
                      <button
                        className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
                        type="button"
                        onClick={handleLocationSearch}
                        disabled={loadingState.geocoding}
                      >
                        {loadingState.geocoding ? 'Searching…' : 'Search'}
                      </button>
                    </div>
                    {locationResults.length > 0 && (
                      <div className="grid gap-1 max-h-32 overflow-y-auto">
                        {locationResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            className={`text-left rounded-lg p-2 text-xs transition ${
                              selectedLocationResultId === result.id
                                ? 'bg-amber-500/20 border border-amber-500/45'
                                : 'border border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                            onClick={() => applyLocationResult(result)}
                          >
                            <strong className="text-white block">{result.label}</strong>
                            <span className="text-slate-400">
                              {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Stop name</span>
                      <input
                        type="text"
                        value={stopForm.name}
                        onChange={(event) => setStopForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Main Gate"
                        className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        required
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Order</span>
                      <input
                        type="number"
                        min="1"
                        value={stopForm.order}
                        onChange={(event) => setStopForm((current) => ({ ...current, order: event.target.value }))}
                        className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        required
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Latitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={stopForm.latitude}
                        onChange={(event) =>
                          setStopForm((current) => ({ ...current, latitude: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        required
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Longitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={stopForm.longitude}
                        onChange={(event) =>
                          setStopForm((current) => ({ ...current, longitude: event.target.value }))
                        }
                        className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        required
                      />
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <button
                      className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition"
                      type="button"
                      onClick={() => {
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
                      }}
                    >
                      Clear form
                    </button>
                    {stopForm.stopId && (
                      <button
                        className="flex-1 px-3 py-2 rounded-lg text-red-200 border border-red-500/45 bg-red-500/12 text-sm font-bold hover:bg-red-500/18 transition disabled:opacity-50"
                        type="button"
                        onClick={handleStopDelete}
                        disabled={loadingState.saving}
                      >
                        Delete stop
                      </button>
                    )}
                    <button className="flex-1 px-3 py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition" type="submit" disabled={loadingState.saving}>
                      {stopForm.stopId ? 'Update stop' : 'Add stop'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
              <div>
                <h3 className="text-lg font-bold text-white">Route map editor</h3>
                <p className="text-slate-400 text-sm">Lightweight coordinate editing for the selected route.</p>
              </div>

              <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/50 min-h-96">
                <TransitMap
                  routes={selectedRouteMap}
                  buses={[]}
                  selectedPoint={selectedPoint}
                  searchResults={locationResults}
                  highlightedSearchResultId={selectedLocationResultId}
                  onSearchResultSelect={applyLocationResult}
                  onMapClick={handleMapSelect}
                />
              </div>

              <div className="grid gap-1 max-h-32 overflow-y-auto">
                {(selectedRoute?.stops || []).map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    className="text-left rounded-lg p-3 border border-white/10 bg-white/5 hover:bg-white/10 transition text-sm"
                    onClick={() =>
                      populateStopForm({
                        ...stop,
                        routeId: selectedRoute.id,
                      })
                    }
                  >
                    <strong className="text-white block">{stop.name}</strong>
                    <span className="text-slate-400 text-xs">
                      #{stop.order} · {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                    </span>
                  </button>
                ))}
                {!selectedRoute?.stops?.length && (
                  <div className="text-center py-8 text-slate-400 text-sm">No stops configured for this route yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'analytics' && (
        <section className="grid gap-4">
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">Usage analytics</h3>
                  <p className="text-slate-400 text-sm">Daily and weekly telemetry activity across the SUBIS platform.</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      analyticsRange === 'daily'
                        ? 'bg-blue-500/20 border border-blue-500/45 text-blue-100'
                        : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setAnalyticsRange('daily');
                      loadAnalytics('daily');
                    }}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      analyticsRange === 'weekly'
                        ? 'bg-blue-500/20 border border-blue-500/45 text-blue-100'
                        : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
                    }`}
                    onClick={() => {
                      setAnalyticsRange('weekly');
                      loadAnalytics('weekly');
                    }}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              {loadingState.analytics ? (
                <div className="py-12 text-center text-slate-400">Loading analytics...</div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <article className="rounded-lg border border-white/10 bg-white/5 p-3 grid gap-1.5">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Telemetry events</span>
                      <strong className="text-2xl text-white">{analytics?.summary?.totalTelemetry ?? '--'}</strong>
                    </article>
                    <article className="rounded-lg border border-white/10 bg-white/5 p-3 grid gap-1.5">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Bus telemetry</span>
                      <strong className="text-2xl text-white">{analytics?.summary?.busTelemetry ?? '--'}</strong>
                    </article>
                    <article className="rounded-lg border border-white/10 bg-white/5 p-3 grid gap-1.5">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Student telemetry</span>
                      <strong className="text-2xl text-white">{analytics?.summary?.userTelemetry ?? '--'}</strong>
                    </article>
                    <article className="rounded-lg border border-white/10 bg-white/5 p-3 grid gap-1.5">
                      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">Active fleet</span>
                      <strong className="text-2xl text-white">{analytics?.summary?.activeBuses ?? '--'}</strong>
                    </article>
                  </div>

                  <BarChart points={analytics?.usageSeries || []} />
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
              <div>
                <h3 className="text-lg font-bold text-white">Crowded-stop heatmap input</h3>
                <p className="text-slate-400 text-sm">Ranked stops for crowd hotspots and operator attention.</p>
              </div>
              <div className="grid gap-2 max-h-96 overflow-y-auto">
                {(analytics?.crowdRankings || []).map((item) => (
                  <article key={item.id} className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-white text-sm block">{item.stopName}</strong>
                        <p className="text-slate-400 text-xs">{item.routeName}</p>
                      </div>
                      <span className="text-white text-xs font-bold">{item.crowdLevel}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${item.intensity * 100}%` }} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-bold text-white">Telemetry logs</h3>
                <p className="text-slate-400 text-sm">Newest-first persisted telemetry with simple source filtering.</p>
              </div>
              <select
                value={logSource}
                onChange={(event) => {
                  const value = event.target.value;
                  setLogSource(value);
                  loadLogs(1, value);
                }}
                className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
              >
                <option value="">All sources</option>
                <option value="BUS">Bus only</option>
                <option value="USER">Student only</option>
              </select>
            </div>

            {loadingState.logs ? (
              <div className="py-12 text-center text-slate-400">Loading telemetry logs...</div>
            ) : (
              <>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-5 gap-3 bg-white/5 p-3 border-b border-white/10 text-xs uppercase tracking-wider font-bold text-slate-400">
                    <span>Time</span>
                    <span>Source</span>
                    <span>Identity</span>
                    <span>Route</span>
                    <span>Coordinates</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {logs.map((item, idx) => (
                      <div key={item.id} className={`grid grid-cols-5 gap-3 p-3 text-xs border-t border-white/5 ${idx % 2 === 0 ? 'bg-white/2' : ''}`}>
                        <span className="text-slate-300">{new Date(item.timestamp).toLocaleString()}</span>
                        <span className="text-slate-300">{item.source}</span>
                        <span className="text-slate-300">{item.busPlateNumber || item.userName || item.busId || item.userId}</span>
                        <span className="text-slate-300">{item.routeName || '—'}</span>
                        <span className="text-slate-300">
                          {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
                    disabled={logsPagination.page <= 1}
                    onClick={() => loadLogs(logsPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span className="text-slate-300 text-sm">
                    Page {logsPagination.page} of {logsPagination.totalPages} · {logsPagination.total} records
                  </span>
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
                    disabled={logsPagination.page >= logsPagination.totalPages}
                    onClick={() => loadLogs(logsPagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
