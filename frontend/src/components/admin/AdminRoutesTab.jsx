import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import TransitMap from '../TransitMap';

function IconButton({ label, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid place-items-center w-9 h-9 rounded-lg border transition ${className}`.trim()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

const EMPTY_STOP_FORM = {
  routeId: '',
  stopId: '',
  name: '',
  latitude: '',
  longitude: '',
  order: '',
};

export default function AdminRoutesTab({
  routeForm,
  setRouteForm,
  loadingState,
  routeOptions,
  selectedRouteId,
  selectedRoute,
  stopForm,
  setStopForm,
  locationQuery,
  setLocationQuery,
  locationResults,
  selectedLocationResultId,
  selectedPoint,
  onRouteCreate,
  onRouteUpdate,
  onRouteSelect,
  onRouteDelete,
  onStopSubmit,
  onStopDelete,
  onLocationSearch,
  onLocationResultSelect,
  onMapSelect,
  onStopPick,
  onClearStopForm,
}) {
  const [editingRouteId, setEditingRouteId] = useState('');
  const [editRouteForm, setEditRouteForm] = useState({ name: '', color: '#3B82F6' });

  const editingRoute = useMemo(
    () => routeOptions.find((route) => route.id === editingRouteId) || null,
    [editingRouteId, routeOptions]
  );

  useEffect(() => {
    if (!editingRouteId) {
      return;
    }

    if (!editingRoute) {
      setEditingRouteId('');
      return;
    }

    setEditRouteForm({
      name: editingRoute.name || '',
      color: editingRoute.color || '#3B82F6',
    });
  }, [editingRoute, editingRouteId]);

  useEffect(() => {
    if (!editingRoute) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editingRoute]);

  const openRouteEditor = (route) => {
    setEditingRouteId(route.id);
    setEditRouteForm({
      name: route.name || '',
      color: route.color || '#3B82F6',
    });
    onRouteSelect(route.id);
    setStopForm({
      ...EMPTY_STOP_FORM,
      routeId: route.id,
    });
    setLocationQuery('');
  };

  const closeRouteEditor = () => {
    setEditingRouteId('');
    onClearStopForm();
    setLocationQuery('');
  };

  const handleRouteSave = async (event) => {
    event.preventDefault();

    if (!editingRoute) {
      return;
    }

    await onRouteUpdate(editingRoute.id, {
      name: editRouteForm.name.trim(),
      color: editRouteForm.color,
    });
  };

  const handleAddNewStop = () => {
    if (!editingRoute) {
      return;
    }

    setStopForm({
      ...EMPTY_STOP_FORM,
      routeId: editingRoute.id,
    });
    setLocationQuery('');
  };

  const handleStopPickForRoute = (stop) => {
    if (!editingRoute) {
      return;
    }

    onStopPick({
      ...stop,
      routeId: editingRoute.id,
    });
  };

  return (
    <section className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4">
        <div>
          <h3 className="text-lg font-bold text-white">Create route</h3>
          <p className="text-slate-400 text-sm">Add a new route, then manage its details and stops from the editor popup.</p>
        </div>

        <form className="grid gap-3 md:grid-cols-[1fr_auto_auto]" onSubmit={onRouteCreate}>
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
          <button
            className="px-4 py-2 rounded-lg font-bold bg-linear-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition self-end"
            type="submit"
            disabled={loadingState.saving}
          >
            {loadingState.saving ? 'Saving…' : 'Create route'}
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-[24rem_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
          <div>
            <h3 className="text-lg font-bold text-white">All routes</h3>
            <p className="text-slate-400 text-sm">Every route is listed here. Use the actions to edit or remove one directly.</p>
          </div>

          <div className="grid gap-2 max-h-[34rem] overflow-y-auto">
            {routeOptions.map((route) => {
              const isSelected = selectedRouteId === route.id || (!selectedRouteId && selectedRoute?.id === route.id);

              return (
                <div
                  key={route.id}
                  className={`rounded-xl p-3 transition ${
                    isSelected
                      ? 'bg-blue-500/15 border border-blue-500/40'
                      : 'border border-white/10 bg-white/5 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                      onClick={() => onRouteSelect(route.id)}
                    >
                      <span className="w-3 h-12 rounded-full shrink-0" style={{ backgroundColor: route.color || '#3B82F6' }} />
                      <div className="min-w-0">
                        <strong className="text-white text-sm block truncate">{route.name}</strong>
                        <p className="text-slate-400 text-xs mt-1">{route.stops?.length || 0} stops</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <IconButton
                        label={`Edit ${route.name}`}
                        onClick={() => openRouteEditor(route)}
                        className="border-blue-500/35 bg-blue-500/10 text-blue-200 hover:bg-blue-500/18"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        label={`Delete ${route.name}`}
                        onClick={() => onRouteDelete(route)}
                        className="border-red-500/35 bg-red-500/10 text-red-200 hover:bg-red-500/18"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })}

            {!routeOptions.length && (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-6 text-center text-slate-400 text-sm">
                No routes available yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Route map</h3>
              <p className="text-slate-400 text-sm">All routes are shown on the map by default.</p>
            </div>
            {selectedRoute && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedRoute.color || '#3B82F6' }} />
                Selected: {selectedRoute.name}
              </div>
            )}
          </div>

          <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/50 min-h-[34rem]">
            {editingRoute ? (
              <div className="h-full min-h-[34rem] grid place-items-center text-center px-6 text-slate-400 text-sm">
                Route editor is open. The route-specific map is shown inside the popup.
              </div>
            ) : (
              <TransitMap routes={routeOptions} buses={[]} />
            )}
          </div>
        </div>
      </div>

      {editingRoute && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
              <div>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-[0.18em]">Route editor</p>
                <h3 className="text-xl font-bold text-white mt-1">{editingRoute.name}</h3>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition"
                onClick={closeRouteEditor}
              >
                Close
              </button>
            </div>

            <div className="grid xl:grid-cols-[28rem_1fr] gap-0">
              <div className="p-6 border-b xl:border-b-0 xl:border-r border-white/10 grid gap-6 content-start max-h-[calc(100vh-8rem)] overflow-y-auto">
                <form className="grid gap-4" onSubmit={handleRouteSave}>
                  <div>
                    <h4 className="text-base font-bold text-white">Route details</h4>
                    <p className="text-slate-400 text-sm mt-1">Update the route name and color from here.</p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Route name</span>
                      <input
                        type="text"
                        value={editRouteForm.name}
                        onChange={(event) =>
                          setEditRouteForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                        required
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Color</span>
                      <input
                        type="color"
                        value={editRouteForm.color}
                        onChange={(event) =>
                          setEditRouteForm((current) => ({
                            ...current,
                            color: event.target.value,
                          }))
                        }
                        className="rounded-lg h-10 cursor-pointer"
                      />
                    </label>
                  </div>

                  <button
                    className="px-4 py-2 rounded-lg font-bold bg-linear-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition"
                    type="submit"
                    disabled={loadingState.saving}
                  >
                    {loadingState.saving ? 'Saving…' : 'Save route details'}
                  </button>
                </form>

                <div className="rounded-2xl border border-white/10 bg-white/4 p-4 grid gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-bold text-white">Stops in this route</h4>
                      <p className="text-slate-400 text-sm mt-1">Add a stop, edit an existing one, or delete the selected stop.</p>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-xs font-bold hover:bg-white/10 transition"
                      onClick={handleAddNewStop}
                    >
                      Add new stop
                    </button>
                  </div>

                  <form className="grid gap-3" onSubmit={onStopSubmit}>
                    <label className="grid gap-1.5">
                      <span className="text-slate-300 text-xs font-bold uppercase">Route</span>
                      <input
                        type="text"
                        value={editingRoute.name}
                        className="rounded-lg border border-white/10 bg-white/5 text-slate-300 p-2 text-sm"
                        readOnly
                      />
                    </label>

                    <div className="rounded-lg border border-white/10 bg-white/3 p-3 grid gap-2">
                      <div>
                        <h5 className="text-sm font-bold text-white">Search location</h5>
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
                              onLocationSearch(event);
                            }
                          }}
                        />
                        <button
                          className="px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition disabled:opacity-50"
                          type="button"
                          onClick={onLocationSearch}
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
                              onClick={() => onLocationResultSelect(result)}
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
                          onChange={(event) => setStopForm((current) => ({ ...current, latitude: event.target.value }))}
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
                          onChange={(event) => setStopForm((current) => ({ ...current, longitude: event.target.value }))}
                          className="rounded-lg border border-white/10 bg-white/5 text-white p-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                          required
                        />
                      </label>
                    </div>

                    <div className="flex gap-3">
                      <button
                        className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition"
                        type="button"
                        onClick={handleAddNewStop}
                      >
                        Clear form
                      </button>
                      {stopForm.stopId && (
                        <button
                          className="flex-1 px-3 py-2 rounded-lg text-red-200 border border-red-500/45 bg-red-500/12 text-sm font-bold hover:bg-red-500/18 transition disabled:opacity-50"
                          type="button"
                          onClick={onStopDelete}
                          disabled={loadingState.saving}
                        >
                          Delete stop
                        </button>
                      )}
                      <button
                        className="flex-1 px-3 py-2 rounded-lg font-bold text-sm bg-linear-to-r from-blue-500 to-blue-600 text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/20 transition"
                        type="submit"
                        disabled={loadingState.saving}
                      >
                        {stopForm.stopId ? 'Update stop' : 'Add stop'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="p-6 grid gap-4 content-start bg-linear-to-br from-slate-950 to-slate-900">
                <div>
                  <h4 className="text-base font-bold text-white">Map and available stops</h4>
                  <p className="text-slate-400 text-sm mt-1">Click the map or a search result to fill stop coordinates for this route.</p>
                </div>

                <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-950/50 min-h-[26rem]">
                  <TransitMap
                    key={`route-editor-map-${editingRoute.id}`}
                    routes={[editingRoute]}
                    buses={[]}
                    selectedPoint={selectedPoint}
                    searchResults={locationResults}
                    highlightedSearchResultId={selectedLocationResultId}
                    onSearchResultSelect={onLocationResultSelect}
                    onMapClick={onMapSelect}
                  />
                </div>

                <div className="grid gap-2 max-h-72 overflow-y-auto">
                  {(editingRoute.stops || []).map((stop) => (
                    <button
                      key={stop.id}
                      type="button"
                      className={`text-left rounded-xl p-3 border transition ${
                        stopForm.stopId === stop.id
                          ? 'border-blue-500/45 bg-blue-500/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => handleStopPickForRoute(stop)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-white text-sm">{stop.name}</strong>
                        <span className="text-slate-400 text-xs">#{stop.order}</span>
                      </div>
                      <span className="text-slate-400 text-xs block mt-1">
                        {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                      </span>
                    </button>
                  ))}

                  {!editingRoute.stops?.length && (
                    <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-6 text-center text-slate-400 text-sm">
                      No stops configured for this route yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
