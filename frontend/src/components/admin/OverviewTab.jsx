import { MetricCard } from '../ui';
import TransitMap from '../TransitMap';

export default function OverviewTab({
  overview,
  loadingState,
  allStops,
  overviewMapRoutes,
  overviewMapBuses,
  loadOverview,
  populateStopForm,
}) {
  return (
    <section className="grid gap-4">
      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-4">
        <MetricCard
          label="Active buses"
          value={overview?.summary?.activeBusCount ?? '--'}
        />
        <MetricCard
          label="Active routes"
          value={overview?.summary?.routeCount ?? '--'}
        />
        <MetricCard
          label="Configured stops"
          value={overview?.summary?.stopCount ?? '--'}
        />
        <MetricCard
          label="Telemetry records"
          value={overview?.summary?.telemetryCount ?? '--'}
        />
      </div>

      {/* Two-column layout: Map and Alerts */}
      <div className="grid gap-4 grid-cols-[1.7fr_1fr]">
        {/* Operations Map */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 min-h-96 flex flex-col">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-100 m-0">Operations map</h3>
              <p className="text-sm text-slate-400 m-0 mt-1">
                All active buses and campus routes in a single live view.
              </p>
            </div>
            <button
              type="button"
              onClick={loadOverview}
              className="px-4 py-2 bg-white/5 border border-white/10 text-slate-100 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
            >
              Refresh
            </button>
          </div>

          {loadingState.overview ? (
            <div className="flex-1 grid place-items-center text-center text-slate-400 border border-dashed border-white/10 rounded-lg">
              Loading live fleet overview...
            </div>
          ) : (
            <div className="flex-1 w-full rounded-lg overflow-hidden border border-white/10 bg-slate-950">
              <TransitMap routes={overviewMapRoutes} buses={overviewMapBuses} />
            </div>
          )}
        </div>

        {/* Alerts and Crowded Stops */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 grid gap-4 grid-rows-[auto_1fr]">
          {/* Active Alerts */}
          <div>
            <div className="mb-3">
              <h3 className="text-lg font-bold text-slate-100 m-0">Active alerts</h3>
              <p className="text-sm text-slate-400 m-0 mt-1">
                Stale bus pings and crowd conditions needing attention.
              </p>
            </div>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {(overview?.alerts || []).length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-4">No active alerts.</div>
              ) : (
                (overview?.alerts || []).map((alert, index) => (
                  <article
                    key={`${alert.type}-${index}`}
                    className={`rounded-lg border p-3 ${
                      alert.severity === 'high'
                        ? 'border-red-500/50 bg-red-900/30 text-red-200'
                        : alert.severity === 'medium'
                          ? 'border-amber-500/50 bg-amber-900/30 text-amber-200'
                          : 'border-blue-500/50 bg-blue-900/30 text-blue-200'
                    }`}
                  >
                    <strong className="block text-sm">{alert.title}</strong>
                    <p className="text-xs mt-1 m-0">{alert.description}</p>
                  </article>
                ))
              )}
            </div>
          </div>

          {/* Crowded Stops */}
          <div className="border-t border-white/10 pt-4">
            <div className="mb-3">
              <h3 className="text-lg font-bold text-slate-100 m-0">Crowded stops</h3>
              <p className="text-sm text-slate-400 m-0 mt-1">
                Jump straight into route editing from the hotspots list.
              </p>
            </div>
            <div className="grid gap-2 max-h-32 overflow-y-auto">
              {(overview?.crowdStops || []).length === 0 ? (
                <div className="text-center text-slate-400 text-sm py-2">No crowded stops.</div>
              ) : (
                (overview?.crowdStops || []).map((stop) => {
                  const fullStop = allStops.find((item) => item.id === stop.id);
                  return (
                    <button
                      type="button"
                      key={stop.id}
                      onClick={() => populateStopForm(fullStop)}
                      className="p-2 text-left bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm"
                    >
                      <span className="block text-slate-100 font-medium">{stop.name}</span>
                      <div className="flex justify-between gap-2 mt-1 text-xs text-slate-400">
                        <span>{stop.routeName}</span>
                        <span>{stop.crowdLevel}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
