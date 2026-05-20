import React from 'react';
import ActiveAlertsList from './ActiveAlertsList';
import AlertFeedBanner from './AlertFeedBanner';
import BusListItem from './BusListItem';

export default function BusSearchPanel({
  visibleBuses,
  nonMatchingBuses,
  matchingBuses,
  searchActive,
  searchStartStop,
  searchEndStop,
  onStartStopChange,
  onEndStopChange,
  onSearch,
  onClear,
  searchLoading,
  searchResults,
  activeAlerts,
  alertFeed,
  onClearAlert,
  selectedBusId,
  onSelectBus,
  armedBuses,
  activeAlarms,
  onToggleArm,
  onStopAlarm,
  getEtaMinutes,
  getBusId,
}) {
  const renderBusCard = (bus, origin = 'live') => {
    const id = getBusId(bus);

    return (
      <BusListItem
        key={`${origin}-${id}`}
        bus={bus}
        isSelected={selectedBusId === id}
        etaMinutes={getEtaMinutes(bus)}
        searchStartStop={searchStartStop}
        armed={Boolean(armedBuses[id])}
        alarming={Boolean(activeAlarms[id])}
        onSelect={() => onSelectBus(bus)}
        onToggleArm={() => onToggleArm(bus)}
        onStopAlarm={() => onStopAlarm(id)}
        getBusId={getBusId}
      />
    );
  };

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
              Trip search
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">Find buses on your route</h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter boarding and destination stops to filter the buses already moving on the map.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Live now</div>
            <strong className="text-sm text-white">{visibleBuses.length}</strong>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="start-stop">
              Start Stop
            </label>
            <input
              id="start-stop"
              type="text"
              placeholder="Where are you boarding?"
              value={searchStartStop}
              onChange={(e) => onStartStopChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="w-full rounded-2xl border border-white/10 bg-[#09131d] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="end-stop">
              End Stop
            </label>
            <input
              id="end-stop"
              type="text"
              placeholder="Where are you headed?"
              value={searchEndStop}
              onChange={(e) => onEndStopChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
              className="w-full rounded-2xl border border-white/10 bg-[#09131d] px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onSearch}
            disabled={searchLoading}
          >
            {searchLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
          {searchResults && (
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
              onClick={onClear}
            >
              Clear
            </button>
          )}
        </div>

        {searchResults && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#09131d] px-3 py-3">
            <p className="text-xs text-slate-400">{searchResults.message}</p>
          </div>
        )}
      </div>

      {!searchActive && (
        <div className="rounded-[24px] border border-white/10 bg-[#09131d] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            How it works
          </p>
          <div className="mt-3 grid gap-2 text-sm text-slate-300">
            <div>1. Browse all active buses already moving on the map.</div>
            <div>2. Search by start stop and destination to narrow the list.</div>
            <div>3. Tap a bus to highlight it on the map and open its trip details.</div>
          </div>
        </div>
      )}

      <AlertFeedBanner alert={alertFeed[0]} />
      <ActiveAlertsList alerts={activeAlerts} onClear={onClearAlert} />

      {searchActive && (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Matching buses
              </p>
              <h4 className="mt-1 text-sm font-semibold text-white">
                Buses touching {searchStartStop || 'your start'} to {searchEndStop || 'your destination'}
              </h4>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Matches</div>
              <strong className="text-sm text-white">{matchingBuses.length}</strong>
            </div>
          </div>

          {matchingBuses.length > 0 ? (
            matchingBuses.map((bus) => renderBusCard(bus, 'matching'))
          ) : (
            <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center text-sm text-slate-400">
              No visible buses in the current mode match this journey.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {searchActive ? 'All active buses' : 'Live fleet'}
            </p>
            <h4 className="mt-1 text-sm font-semibold text-white">
              {searchActive
                ? 'Other buses still visible on the map'
                : 'Every bus currently shown on the map'}
            </h4>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Total</div>
            <strong className="text-sm text-white">{searchActive ? nonMatchingBuses.length : visibleBuses.length}</strong>
          </div>
        </div>

        {(searchActive ? nonMatchingBuses : visibleBuses).length > 0 ? (
          (searchActive ? nonMatchingBuses : visibleBuses).map((bus) => renderBusCard(bus, 'fleet'))
        ) : (
          <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-8 text-center text-sm text-slate-400">
            {searchActive
              ? 'No additional buses remain outside your current search.'
              : 'No buses are active in this mode right now.'}
          </div>
        )}
      </div>
    </div>
  );
}
