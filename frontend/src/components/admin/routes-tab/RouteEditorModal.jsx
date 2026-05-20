import TransitMap from '../../transit-map';

export default function RouteEditorModal({
  editingRoute,
  editRouteForm,
  setEditRouteForm,
  loadingState,
  closeRouteEditor,
  handleRouteSave,
  handleAddNewStop,
  onStopSubmit,
  stopForm,
  setStopForm,
  locationQuery,
  setLocationQuery,
  onLocationSearch,
  locationResults,
  selectedLocationResultId,
  onLocationResultSelect,
  onStopDelete,
  selectedPoint,
  onMapSelect,
  handleStopPickForRoute,
}) {
  if (!editingRoute) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm md:p-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Route editor</p>
            <h3 className="mt-1 text-xl font-bold text-white">{editingRoute.name}</h3>
          </div>
          <button
            type="button"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
            onClick={closeRouteEditor}
          >
            Close
          </button>
        </div>

        <div className="grid gap-0 xl:grid-cols-[28rem_1fr]">
          <div className="grid max-h-[calc(100vh-8rem)] content-start gap-6 overflow-y-auto border-b border-white/10 p-6 xl:border-r xl:border-b-0">
            <form className="grid gap-4" onSubmit={handleRouteSave}>
              <div>
                <h4 className="text-base font-bold text-white">Route details</h4>
                <p className="mt-1 text-sm text-slate-400">Update the route name and color from here.</p>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase text-slate-300">Route name</span>
                  <input
                    type="text"
                    value={editRouteForm.name}
                    onChange={(event) =>
                      setEditRouteForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase text-slate-300">Color</span>
                  <input
                    type="color"
                    value={editRouteForm.color}
                    onChange={(event) =>
                      setEditRouteForm((current) => ({
                        ...current,
                        color: event.target.value,
                      }))
                    }
                    className="h-10 cursor-pointer rounded-lg"
                  />
                </label>
              </div>

              <button
                className="rounded-lg bg-linear-to-r from-blue-500 to-blue-600 px-4 py-2 font-bold text-slate-950 transition hover:shadow-lg hover:shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loadingState.saving}
              >
                {loadingState.saving ? 'Saving…' : 'Save route details'}
              </button>
            </form>

            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-white">Stops in this route</h4>
                  <p className="mt-1 text-sm text-slate-400">Add a stop, edit an existing one, or delete the selected stop.</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                  onClick={handleAddNewStop}
                >
                  Add new stop
                </button>
              </div>

              <form className="grid gap-3" onSubmit={onStopSubmit}>
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase text-slate-300">Route</span>
                  <input
                    type="text"
                    value={editingRoute.name}
                    className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-slate-300"
                    readOnly
                  />
                </label>

                <div className="grid gap-2 rounded-lg border border-white/10 bg-white/3 p-3">
                  <div>
                    <h5 className="text-sm font-bold text-white">Search location</h5>
                    <p className="mt-1 text-xs text-slate-400">Find a place name and use its coordinates for this stop.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={locationQuery}
                      onChange={(event) => setLocationQuery(event.target.value)}
                      placeholder="Search campus gate, department, street, or landmark"
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onLocationSearch(event);
                        }
                      }}
                    />
                    <button
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                      type="button"
                      onClick={onLocationSearch}
                      disabled={loadingState.geocoding}
                    >
                      {loadingState.geocoding ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  {locationResults.length > 0 && (
                    <div className="grid max-h-32 gap-1 overflow-y-auto">
                      {locationResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          className={`rounded-lg p-2 text-left text-xs transition ${
                            selectedLocationResultId === result.id
                              ? 'border border-amber-500/45 bg-amber-500/20'
                              : 'border border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => onLocationResultSelect(result)}
                        >
                          <strong className="block text-white">{result.label}</strong>
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
                    <span className="text-xs font-bold uppercase text-slate-300">Stop name</span>
                    <input
                      type="text"
                      value={stopForm.name}
                      onChange={(event) => setStopForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Main Gate"
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition placeholder-white/40 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase text-slate-300">Order</span>
                    <input
                      type="number"
                      min="1"
                      value={stopForm.order}
                      onChange={(event) => setStopForm((current) => ({ ...current, order: event.target.value }))}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      required
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase text-slate-300">Latitude</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={stopForm.latitude}
                      onChange={(event) => setStopForm((current) => ({ ...current, latitude: event.target.value }))}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      required
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold uppercase text-slate-300">Longitude</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={stopForm.longitude}
                      onChange={(event) => setStopForm((current) => ({ ...current, longitude: event.target.value }))}
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm text-white transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      required
                    />
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/10"
                    type="button"
                    onClick={handleAddNewStop}
                  >
                    Clear form
                  </button>
                  {stopForm.stopId && (
                    <button
                      className="flex-1 rounded-lg border border-red-500/45 bg-red-500/12 px-3 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/18 disabled:opacity-50"
                      type="button"
                      onClick={onStopDelete}
                      disabled={loadingState.saving}
                    >
                      Delete stop
                    </button>
                  )}
                  <button
                    className="flex-1 rounded-lg bg-linear-to-r from-blue-500 to-blue-600 px-3 py-2 text-sm font-bold text-slate-950 transition hover:shadow-lg hover:shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={loadingState.saving}
                  >
                    {stopForm.stopId ? 'Update stop' : 'Add stop'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="grid content-start gap-4 bg-linear-to-br from-slate-950 to-slate-900 p-6">
            <div>
              <h4 className="text-base font-bold text-white">Map and available stops</h4>
              <p className="mt-1 text-sm text-slate-400">Click the map or a search result to fill stop coordinates for this route.</p>
            </div>

            <div className="min-h-[26rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950/50">
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

            <div className="grid max-h-72 gap-2 overflow-y-auto">
              {(editingRoute.stops || []).map((stop) => (
                <button
                  key={stop.id}
                  type="button"
                  className={`rounded-xl border p-3 text-left transition ${
                    stopForm.stopId === stop.id
                      ? 'border-blue-500/45 bg-blue-500/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => handleStopPickForRoute(stop)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-white">{stop.name}</strong>
                    <span className="text-xs text-slate-400">#{stop.order}</span>
                  </div>
                  <span className="mt-1 block text-xs text-slate-400">
                    {stop.latitude.toFixed(5)}, {stop.longitude.toFixed(5)}
                  </span>
                </button>
              ))}

              {!editingRoute.stops?.length && (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-6 text-center text-sm text-slate-400">
                  No stops configured for this route yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
