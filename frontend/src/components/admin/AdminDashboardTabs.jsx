import React from 'react';
const tabLabels = {
  overview: 'Operations Overview',
  routes: 'Route Manager',
  analytics: 'Analytics',
};

export default function AdminDashboardTabs({ activeTab, onTabChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {Object.entries(tabLabels).map(([key, label]) => (
        <button
          key={key}
          type="button"
          className={`rounded-full px-4 py-2 font-bold text-sm transition transform hover:-translate-y-0.5 ${
            activeTab === key
              ? 'bg-blue-500/20 border border-blue-500/45 text-blue-100'
              : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
          }`}
          onClick={() => onTabChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
