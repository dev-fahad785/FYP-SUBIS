import React from 'react';
import TransitMap from '../TransitMap';

function OverviewStatCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-2">
      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">{label}</span>
      <strong className="text-3xl text-white">{value}</strong>
    </article>
  );
}

export default function AdminOverviewTab({
  overview,
  loadingState,
  overviewMapRoutes,
  overviewMapBuses,
  allStops,
  loadOverview,
  populateStopForm,
}) {
  return (
    <section className="grid gap-4">
      <div className="grid grid-cols-4 gap-3">
        <OverviewStatCard label="Active buses" value={overview?.summary?.activeBusCount ?? '--'} />
        <OverviewStatCard label="Active routes" value={overview?.summary?.routeCount ?? '--'} />
        <OverviewStatCard label="Configured stops" value={overview?.summary?.stopCount ?? '--'} />
        <OverviewStatCard label="Telemetry records" value={overview?.summary?.telemetryCount ?? '--'} />
      </div>

      <div className="grid lg:grid-cols-[1.7fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 min-h-96 flex flex-col">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Operations map</h3>
              <p className="text-slate-400 text-sm">All active buses and campus routes in a single live view.</p>
            </div>
            <button
              className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition"
              type="button"
              onClick={loadOverview}
            >
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

        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
          <div>
            <h3 className="text-lg font-bold text-white">Active alerts</h3>
            <p className="text-slate-400 text-sm">Stale bus pings and crowd conditions needing attention.</p>
          </div>
          <div className="grid gap-2 max-h-48 overflow-y-auto">
            {(overview?.alerts || []).length === 0 && <div className="text-center py-8 text-slate-400">No active alerts.</div>}
            {(overview?.alerts || []).map((alert, index) => (
              <article
                key={`${alert.type}-${index}`}
                className={`rounded-lg p-3 border ${
                  alert.severity === 'high'
                    ? 'border-red-500/35 bg-red-500/10'
                    : 'border-amber-500/35 bg-amber-500/10'
                }`}
              >
                <strong className="text-white text-sm">{alert.title}</strong>
                <p className={`text-sm mt-1 ${alert.severity === 'high' ? 'text-red-200' : 'text-amber-200'}`}>
                  {alert.description}
                </p>
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
  );
}
