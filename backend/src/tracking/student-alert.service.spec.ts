import { StudentAlertService } from './student-alert.service';

describe('StudentAlertService', () => {
  let service: StudentAlertService;

  beforeEach(() => {
    service = new StudentAlertService();
  });

  it('only triggers once for the same bus trip', () => {
    service.registerAlert('socket-1', {
      routeId: 'route-1',
      routeName: 'Route 1',
      startStopName: 'Main Station',
      endStopName: 'City Center',
      triggerStopName: 'University Stop',
      triggerStopOrder: 2,
    });

    const firstPass = service.evaluateBusUpdate({
      busId: 'bus-1',
      routeId: 'route-1',
      currentStop: 'University Stop',
      nextStopEtaMinutes: 4,
    });

    const secondPass = service.evaluateBusUpdate({
      busId: 'bus-1',
      routeId: 'route-1',
      currentStop: 'University Stop',
      nextStopEtaMinutes: 3,
    });

    expect(firstPass).toHaveLength(1);
    expect(firstPass[0].message).toContain('Main Station');
    expect(secondPass).toHaveLength(0);
  });
});
