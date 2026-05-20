import React from 'react';
export default function AlertFeedBanner({ alert }) {
  if (!alert) return null;

  return (
    <div className="rounded-[24px] border border-emerald-300/18 bg-emerald-400/10 p-4">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
        Latest alert
      </p>
      <p className="text-sm leading-relaxed text-emerald-100">
        {alert.message} ETA to start stop:{' '}
        <strong className="text-white">{alert.etaMinutes ?? 'unknown'} min</strong>.
      </p>
    </div>
  );
}
