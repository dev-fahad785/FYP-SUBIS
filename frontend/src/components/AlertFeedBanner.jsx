import React from 'react';
export default function AlertFeedBanner({ alert }) {
  if (!alert) return null;

  return (
    <div className="mt-4 p-3 bg-emerald-950/50 border border-emerald-700/40 rounded-lg">
      <p className="text-xs font-semibold text-emerald-400 mb-0.5 uppercase tracking-wider">
        Latest alert
      </p>
      <p className="text-xs text-emerald-300 leading-relaxed">
        {alert.message} ETA to start stop:{' '}
        <strong>{alert.etaMinutes ?? 'unknown'} min</strong>.
      </p>
    </div>
  );
}
