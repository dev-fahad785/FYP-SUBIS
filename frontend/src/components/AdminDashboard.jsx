import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import TransitMap from './TransitMap';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const tabLabels = {
  overview: 'Operations Overview',
  routes: 'Route Manager',
  analytics: 'Analytics',
};

function BarChart({ points = [] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <div className="chart-grid">
      {points.map((point) => (
        <div key={point.label} className="chart-bar-wrap">
          <div
            className="chart-bar"
            style={{ height: `${Math.max((point.total / maxValue) * 100, point.total ? 12 : 4)}%` }}
            title={`${point.label}: ${point.total}`}
          />
          <span>{point.label}</span>
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

  const loadOverview = async () => {
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
  };

  const loadAnalytics = async (range = analyticsRange) => {
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
  };

  const loadLogs = async (page = 1, source = logSource) => {
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
  };

  useEffect(() => {
    loadOverview();
    loadAnalytics();
    loadLogs();
  }, []);

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

  const routeOptions = overview?.routes || [];
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
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">SUBIS · Admin Console</p>
          <h2>Welcome back, {currentUserName || 'Admin'}</h2>
          <p className="lede">
            Monitor fleet activity, review telemetry, and keep route data current from a single workspace.
          </p>
        </div>
        <button className="ghost" type="button" onClick={onLogout}>
          Log out
        </button>
      </div>

      {feedback.message && (
        <div className={`banner ${feedback.type === 'error' ? 'error' : 'success'}`}>
          {feedback.message}
        </div>
      )}

      <div className="tab-strip">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-button ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="dashboard-section">
          <div className="metrics-grid">
            <article className="metric-card">
              <span className="metric-label">Active buses</span>
              <strong>{overview?.summary?.activeBusCount ?? '--'}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Active routes</span>
              <strong>{overview?.summary?.routeCount ?? '--'}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Configured stops</span>
              <strong>{overview?.summary?.stopCount ?? '--'}</strong>
            </article>
            <article className="metric-card">
              <span className="metric-label">Telemetry records</span>
              <strong>{overview?.summary?.telemetryCount ?? '--'}</strong>
            </article>
          </div>

          <div className="dashboard-grid two-column">
            <div className="panel large flex flex-col">
              <div className="panel-header">
                <div>
                  <h3>Operations map</h3>
                  <p>All active buses and campus routes in a single live view.</p>
                </div>
                <button className="ghost" type="button" onClick={loadOverview}>
                  Refresh
                </button>
              </div>

              {loadingState.overview ? (
                <div className="panel-empty">Loading live fleet overview...</div>
              ) : (
                <div className="map-frame dashboard-map-frame">
                  <TransitMap routes={overviewMapRoutes} buses={overviewMapBuses} />
                </div>
              )}
            </div>

            <div className="panel stack">
              <div className="panel-header">
                <div>
                  <h3>Active alerts</h3>
                  <p>Stale bus pings and crowd conditions needing attention.</p>
                </div>
              </div>
              <div className="alert-list">
                {(overview?.alerts || []).length === 0 && <div className="panel-empty">No active alerts.</div>}
                {(overview?.alerts || []).map((alert, index) => (
                  <article key={`${alert.type}-${index}`} className={`alert-card severity-${alert.severity}`}>
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                  </article>
                ))}
              </div>

              <div className="panel-subsection">
                <div className="panel-header">
                  <div>
                    <h3>Crowded stops</h3>
                    <p>Jump straight into route editing from the hotspots list.</p>
                  </div>
                </div>
                <div className="crowd-stop-list">
                  {(overview?.crowdStops || []).map((stop) => {
                    const fullStop = allStops.find((item) => item.id === stop.id);
                    return (
                      <button
                        type="button"
                        key={stop.id}
                        className="crowd-stop-card"
                        onClick={() => populateStopForm(fullStop)}
                      >
                        <span>{stop.name}</span>
                        <strong>{stop.routeName}</strong>
                        <em>{stop.crowdLevel}</em>
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
        <section className="dashboard-section">
          <div className="dashboard-grid two-column">
            <div className="panel stack">
              <div className="panel-header">
                <div>
                  <h3>Route manager</h3>
                  <p>Create routes, update route details, and adjust stop coordinates.</p>
                </div>
              </div>

              <form className="form compact-form" onSubmit={handleRouteCreate}>
                <div className="form-row">
                  <label className="field">
                    <span>Route name</span>
                    <input
                      type="text"
                      value={routeForm.name}
                      onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Blue Line"
                      required
                    />
                  </label>
                  <label className="field color-field">
                    <span>Color</span>
                    <input
                      type="color"
                      value={routeForm.color}
                      onChange={(event) => setRouteForm((current) => ({ ...current, color: event.target.value }))}
                    />
                  </label>
                </div>
                <button className="primary" type="submit" disabled={loadingState.saving}>
                  {loadingState.saving ? 'Saving…' : 'Create route'}
                </button>
              </form>

              <div className="route-list">
                {routeOptions.map((route) => (
                  <button
                    key={route.id}
                    type="button"
                    className={`route-list-item ${selectedRouteId === route.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedRouteId(route.id);
                      setStopForm((current) => ({ ...current, routeId: route.id }));
                    }}
                  >
                    <span className="route-color" style={{ backgroundColor: route.color || '#3B82F6' }} />
                    <div>
                      <strong>{route.name}</strong>
                      <p>{route.stops?.length || 0} stops</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="route-edit-card">
                <div className="panel-header">
                  <div>
                    <h3>{selectedRoute?.name || 'Select a route'}</h3>
                    <p>Click the map to fill latitude and longitude for a stop.</p>
                  </div>
                </div>

                <form className="form compact-form" onSubmit={handleStopSubmit}>
                  <label className="field">
                    <span>Route</span>
                    <select
                      value={stopForm.routeId}
                      onChange={(event) =>
                        setStopForm((current) => ({ ...current, routeId: event.target.value }))
                      }
                    >
                      {routeOptions.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="location-search-block">
                    <div className="panel-header">
                      <div>
                        <h3>Search location</h3>
                        <p>Find a place name and use its coordinates for this stop.</p>
                      </div>
                    </div>
                    <div className="location-search-form">
                      <input
                        type="text"
                        value={locationQuery}
                        onChange={(event) => setLocationQuery(event.target.value)}
                        placeholder="Search campus gate, department, street, or landmark"
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleLocationSearch(event);
                          }
                        }}
                      />
                      <button
                        className="ghost"
                        type="button"
                        onClick={handleLocationSearch}
                        disabled={loadingState.geocoding}
                      >
                        {loadingState.geocoding ? 'Searching…' : 'Search'}
                      </button>
                    </div>
                    {locationResults.length > 0 && (
                      <div className="location-results">
                        {locationResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            className={`location-result ${
                              selectedLocationResultId === result.id ? 'active' : ''
                            }`}
                            onClick={() => applyLocationResult(result)}
                          >
                            <strong>{result.label}</strong>
                            <span>
                              {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <label className="field">
                      <span>Stop name</span>
                      <input
                        type="text"
                        value={stopForm.name}
                        onChange={(event) => setStopForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Main Gate"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Order</span>
                      <input
                        type="number"
                        min="1"
                        value={stopForm.order}
                        onChange={(event) => setStopForm((current) => ({ ...current, order: event.target.value }))}
                        required
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label className="field">
                      <span>Latitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={stopForm.latitude}
                        onChange={(event) =>
                          setStopForm((current) => ({ ...current, latitude: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Longitude</span>
                      <input
                        type="number"
                        step="0.000001"
                        value={stopForm.longitude}
                        onChange={(event) =>
                          setStopForm((current) => ({ ...current, longitude: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <div className="actions">
                    <button
                      className="ghost"
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
                    <button className="primary" type="submit" disabled={loadingState.saving}>
                      {stopForm.stopId ? 'Update stop' : 'Add stop'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="panel stack">
              <div className="panel-header">
                <div>
                  <h3>Route map editor</h3>
                  <p>Lightweight coordinate editing for the selected route.</p>
                </div>
              </div>

              <div className="map-frame dashboard-map-frame">
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

              <div className="stop-table">
                {(selectedRoute?.stops || []).map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    className="stop-row"
                    onClick={() =>
                      populateStopForm({
                        ...stop,
                        routeId: selectedRoute.id,
                      })
                    }
                  >
                    <strong>{stop.name}</strong>
                    <span>
                      #{stop.order} · {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                    </span>
                  </button>
                ))}
                {!selectedRoute?.stops?.length && (
                  <div className="panel-empty">No stops configured for this route yet.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'analytics' && (
        <section className="dashboard-section">
          <div className="dashboard-grid two-column">
            <div className="panel large stack">
              <div className="panel-header">
                <div>
                  <h3>Usage analytics</h3>
                  <p>Daily and weekly telemetry activity across the SUBIS platform.</p>
                </div>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`ghost ${analyticsRange === 'daily' ? 'selected' : ''}`}
                    onClick={() => {
                      setAnalyticsRange('daily');
                      loadAnalytics('daily');
                    }}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    className={`ghost ${analyticsRange === 'weekly' ? 'selected' : ''}`}
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
                <div className="panel-empty">Loading analytics...</div>
              ) : (
                <>
                  <div className="metrics-grid">
                    <article className="metric-card">
                      <span className="metric-label">Telemetry events</span>
                      <strong>{analytics?.summary?.totalTelemetry ?? '--'}</strong>
                    </article>
                    <article className="metric-card">
                      <span className="metric-label">Bus telemetry</span>
                      <strong>{analytics?.summary?.busTelemetry ?? '--'}</strong>
                    </article>
                    <article className="metric-card">
                      <span className="metric-label">Student telemetry</span>
                      <strong>{analytics?.summary?.userTelemetry ?? '--'}</strong>
                    </article>
                    <article className="metric-card">
                      <span className="metric-label">Active fleet</span>
                      <strong>{analytics?.summary?.activeBuses ?? '--'}</strong>
                    </article>
                  </div>

                  <BarChart points={analytics?.usageSeries || []} />
                </>
              )}
            </div>

            <div className="panel stack">
              <div className="panel-header">
                <div>
                  <h3>Crowded-stop heatmap input</h3>
                  <p>Ranked stops for crowd hotspots and operator attention.</p>
                </div>
              </div>
              <div className="heatmap-list">
                {(analytics?.crowdRankings || []).map((item) => (
                  <article key={item.id} className="heat-row">
                    <div>
                      <strong>{item.stopName}</strong>
                      <p>{item.routeName}</p>
                    </div>
                    <div className="heat-meter">
                      <div className="heat-meter-fill" style={{ width: `${item.intensity * 100}%` }} />
                    </div>
                    <span>{item.crowdLevel}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="panel stack">
            <div className="panel-header">
              <div>
                <h3>Telemetry logs</h3>
                <p>Newest-first persisted telemetry with simple source filtering.</p>
              </div>
              <div className="toggle-group">
                <select
                  value={logSource}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLogSource(value);
                    loadLogs(1, value);
                  }}
                >
                  <option value="">All sources</option>
                  <option value="BUS">Bus only</option>
                  <option value="USER">Student only</option>
                </select>
              </div>
            </div>

            {loadingState.logs ? (
              <div className="panel-empty">Loading telemetry logs...</div>
            ) : (
              <>
                <div className="log-table">
                  <div className="log-header">
                    <span>Time</span>
                    <span>Source</span>
                    <span>Identity</span>
                    <span>Route</span>
                    <span>Coordinates</span>
                  </div>
                  {logs.map((item) => (
                    <div key={item.id} className="log-row">
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                      <span>{item.source}</span>
                      <span>{item.busPlateNumber || item.userName || item.busId || item.userId}</span>
                      <span>{item.routeName || '—'}</span>
                      <span>
                        {Number(item.latitude).toFixed(4)}, {Number(item.longitude).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pagination-row">
                  <button
                    type="button"
                    className="ghost"
                    disabled={logsPagination.page <= 1}
                    onClick={() => loadLogs(logsPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {logsPagination.page} of {logsPagination.totalPages} · {logsPagination.total} records
                  </span>
                  <button
                    type="button"
                    className="ghost"
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
