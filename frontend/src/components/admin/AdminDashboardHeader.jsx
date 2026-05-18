import React from 'react';
export default function AdminDashboardHeader({ currentUserName, onLogout }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div>
        <p className="text-blue-400 text-xs uppercase tracking-widest font-bold">SUBIS · Admin Console</p>
        <h2 className="text-3xl font-bold text-white mt-2">Welcome back, {currentUserName || 'Admin'}</h2>
        <p className="text-slate-300 text-base max-w-3xl leading-relaxed mt-2">
          Monitor fleet activity, review telemetry, and keep route data current from a single workspace.
        </p>
      </div>
      <button
        className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white font-bold hover:bg-white/10 transition transform hover:-translate-y-0.5"
        type="button"
        onClick={onLogout}
      >
        Log out
      </button>
    </div>
  );
}
