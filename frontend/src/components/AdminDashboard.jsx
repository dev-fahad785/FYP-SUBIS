import React from 'react';

import AdminDashboardHeader from './admin/AdminDashboardHeader';
import AdminDashboardTabs from './admin/AdminDashboardTabs';
import AdminOverviewTab from './admin/AdminOverviewTab';
import AdminRoutesTab from './admin/AdminRoutesTab';
import AdminAnalyticsTab from './admin/AdminAnalyticsTab';
import useAdminDashboard from '../hooks/useAdminDashboard';

export default function AdminDashboard({ authToken, currentUserName, onLogout }) {
  const dashboard = useAdminDashboard(authToken);

  return (
    <div className="grid gap-4">
      <AdminDashboardHeader currentUserName={currentUserName} onLogout={onLogout} />

      {dashboard.feedback.message && (
        <div
          className={`rounded-lg p-3 font-semibold text-sm border ${
            dashboard.feedback.type === 'error'
              ? 'bg-red-500/15 border-red-500/35 text-red-200'
              : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-200'
          }`}
        >
          {dashboard.feedback.message}
        </div>
      )}

      <AdminDashboardTabs activeTab={dashboard.activeTab} onTabChange={dashboard.setActiveTab} />

      {dashboard.activeTab === 'overview' && (
        <AdminOverviewTab
          overview={dashboard.overview}
          loadingState={dashboard.loadingState}
          overviewMapRoutes={dashboard.overviewMapRoutes}
          overviewMapBuses={dashboard.overviewMapBuses}
          allStops={dashboard.allStops}
          loadOverview={dashboard.loadOverview}
          populateStopForm={dashboard.populateStopForm}
        />
      )}

      {dashboard.activeTab === 'routes' && (
        <AdminRoutesTab
          routeForm={dashboard.routeForm}
          setRouteForm={dashboard.setRouteForm}
          loadingState={dashboard.loadingState}
          routeOptions={dashboard.routeOptions}
          selectedRouteId={dashboard.selectedRouteId}
          selectedRoute={dashboard.selectedRoute}
          stopForm={dashboard.stopForm}
          setStopForm={dashboard.setStopForm}
          locationQuery={dashboard.locationQuery}
          setLocationQuery={dashboard.setLocationQuery}
          locationResults={dashboard.locationResults}
          selectedLocationResultId={dashboard.selectedLocationResultId}
          selectedPoint={dashboard.selectedPoint}
          selectedRouteMap={dashboard.selectedRouteMap}
          onRouteCreate={dashboard.handleRouteCreate}
          onRouteUpdate={dashboard.handleRouteUpdate}
          onRouteSelect={dashboard.handleRouteSelect}
          onRouteDelete={dashboard.handleRouteDelete}
          onStopSubmit={dashboard.handleStopSubmit}
          onStopDelete={dashboard.handleStopDelete}
          onLocationSearch={dashboard.handleLocationSearch}
          onLocationResultSelect={dashboard.applyLocationResult}
          onMapSelect={dashboard.handleMapSelect}
          onStopPick={dashboard.populateStopForm}
          onClearStopForm={dashboard.clearStopForm}
        />
      )}

      {dashboard.activeTab === 'analytics' && (
        <AdminAnalyticsTab
          analyticsRange={dashboard.analyticsRange}
          analytics={dashboard.analytics}
          logs={dashboard.logs}
          logsPagination={dashboard.logsPagination}
          logSource={dashboard.logSource}
          loadingState={dashboard.loadingState}
          onAnalyticsRangeChange={dashboard.handleAnalyticsRangeChange}
          onLogSourceChange={dashboard.handleLogSourceChange}
          loadLogs={dashboard.loadLogs}
        />
      )}
    </div>
  );
}
