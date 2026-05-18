import React from 'react';
function BarChart({ points = [] }) {
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,_minmax(28px,_1fr))] items-end gap-2.5 min-h-64 p-4 rounded-lg bg-white/3">
      {points.map((point) => (
        <div key={point.label} className="grid gap-2 justify-items-center h-full">
          <div
            className="w-full rounded-t-xl bg-linear-to-t from-blue-600 to-blue-400"
            style={{ height: `${Math.max((point.total / maxValue) * 100, point.total ? 12 : 4)}%` }}
            title={`${point.label}: ${point.total}`}
          />
          <span className="text-xs text-slate-400">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

function AnalyticsSummaryCard({ label, value }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/5 p-3 grid gap-1.5">
      <span className="text-xs uppercase tracking-wider font-bold text-slate-400">{label}</span>
      <strong className="text-2xl text-white">{value}</strong>
    </article>
  );
}

export default function AdminAnalyticsTab({
  analyticsRange,
  analytics,
  logs,
  logsPagination,
  logSource,
  loadingState,
  onAnalyticsRangeChange,
  onLogSourceChange,
  loadLogs,
}) {
  return (
    <section className="grid gap-4">
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-4">
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
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
                onClick={() => onAnalyticsRangeChange('daily')}
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
                onClick={() => onAnalyticsRangeChange('weekly')}
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
                <AnalyticsSummaryCard label="Telemetry events" value={analytics?.summary?.totalTelemetry ?? '--'} />
                <AnalyticsSummaryCard label="Bus telemetry" value={analytics?.summary?.busTelemetry ?? '--'} />
                <AnalyticsSummaryCard label="Student telemetry" value={analytics?.summary?.userTelemetry ?? '--'} />
                <AnalyticsSummaryCard label="Active fleet" value={analytics?.summary?.activeBuses ?? '--'} />
              </div>

              <BarChart points={analytics?.usageSeries || []} />
            </>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4 content-start">
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
                  <div className="h-full bg-linear-to-r from-amber-500 to-red-500" style={{ width: `${item.intensity * 100}%` }} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 to-slate-950/60 p-4 grid gap-4">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Telemetry logs</h3>
            <p className="text-slate-400 text-sm">Newest-first persisted telemetry with simple source filtering.</p>
          </div>
          <select
            value={logSource}
            onChange={(event) => onLogSourceChange(event.target.value)}
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
  );
}
