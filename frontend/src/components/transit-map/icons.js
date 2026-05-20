import L from 'leaflet';

function createBusIcon(simulated = false, highlighted = false) {
  const baseSize = highlighted ? 64 : 44;
  const innerSize = highlighted ? 40 : 24;

  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-bus-marker ${simulated ? 'simulated' : ''} ${highlighted ? 'highlighted' : ''}">
        <div class="transit-bus-ripple"></div>
        <div class="transit-bus-icon" style="width: ${innerSize}px; height: ${innerSize}px; font-size: ${highlighted ? '20px' : '14px'};">
          <span>B</span>
        </div>
      </div>
    `,
    iconSize: [baseSize, baseSize],
    iconAnchor: [baseSize / 2, baseSize / 2],
  });
}

export const busIcon = createBusIcon();
export const simulatedBusIcon = createBusIcon(true);
export const highlightedBusIcon = createBusIcon(false, true);
export const highlightedSimulatedBusIcon = createBusIcon(true, true);

export function createStopIcon(color = '#3B82F6') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `
      <div class="transit-stop-pin" style="--stop-color:${color};">
        <span class="transit-stop-pin-core"></span>
      </div>
    `,
    iconSize: [24, 32],
    iconAnchor: [12, 30],
  });
}

export function createStudentDotIcon(color = '#22C55E') {
  return L.divIcon({
    className: 'transit-icon-wrapper',
    html: `<div class="transit-student-dot" style="--marker-color:${color};"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}
