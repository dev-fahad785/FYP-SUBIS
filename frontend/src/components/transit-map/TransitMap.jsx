import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { DEFAULT_CENTER } from './constants';
import { FitMapToContent, MapClickHandler, ResizeMap } from './MapControllers';
import {
  BusMarkers,
  RouteLayers,
  SearchResultMarkers,
  SelectedPointMarker,
  StudentMarkers,
} from './MapLayers';

export default function TransitMap({
  routes = [],
  buses = [],
  students = [],
  center = DEFAULT_CENTER,
  zoom = 14,
  className = '',
  onBusSelect,
  highlightedBusIds = [],
  selectedPoint = null,
  searchResults = [],
  highlightedSearchResultId = '',
  onSearchResultSelect,
  onMapClick,
  hideRoutes = false,
  hideStops = false,
  fitToBusesOnly = false,
}) {
  return (
    <div className={`transit-map-shell ${className}`.trim()}>
      <MapContainer center={center} zoom={zoom} className="transit-map">
        <ResizeMap />
        <MapClickHandler onMapClick={onMapClick} />
        <FitMapToContent
          routes={routes}
          buses={buses}
          searchResults={searchResults}
          selectedPoint={selectedPoint}
          center={center}
          zoom={zoom}
          fitToBusesOnly={fitToBusesOnly}
        />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <RouteLayers routes={routes} hideRoutes={hideRoutes} hideStops={hideStops} />
        <BusMarkers buses={buses} highlightedBusIds={highlightedBusIds} onBusSelect={onBusSelect} />
        <SearchResultMarkers
          searchResults={searchResults}
          highlightedSearchResultId={highlightedSearchResultId}
          onSearchResultSelect={onSearchResultSelect}
        />
        <SelectedPointMarker selectedPoint={selectedPoint} />
        <StudentMarkers students={students} />
      </MapContainer>
    </div>
  );
}
