import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { ClusteringService } from './clustering.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAlertService } from './student-alert.service';

describe('TrackingGateway alert registration', () => {
  let gateway: TrackingGateway;
  let prisma: {
    route: {
      findUnique: jest.Mock;
    };
  };
  let studentAlertService: StudentAlertService;

  beforeEach(() => {
    prisma = {
      route: {
        findUnique: jest.fn(),
      },
    };

    studentAlertService = new StudentAlertService();

    gateway = new TrackingGateway(
      {} as TrackingService,
      {} as ClusteringService,
      prisma as unknown as PrismaService,
      studentAlertService,
    );
  });

  it('rejects alerts when the trigger stop is not the stop before the selected start stop', async () => {
    prisma.route.findUnique.mockResolvedValue({
      id: 'route-1',
      name: 'Route 1',
      stops: [
        { id: 'stop-1', name: 'First Stop', order: 1 },
        { id: 'stop-2', name: 'Second Stop', order: 2 },
        { id: 'stop-3', name: 'Third Stop', order: 3 },
        { id: 'stop-4', name: 'Fourth Stop', order: 4 },
      ],
    });

    const result = await gateway.handleRegisterStudentAlert(
      {
        routeId: 'route-1',
        startStopName: 'Third Stop',
        endStopName: 'Fourth Stop',
        triggerStopName: 'First Stop',
        triggerStopOrder: 1,
      },
      { id: 'socket-1', emit: jest.fn() } as never,
    );

    expect(result).toEqual({ status: 'invalid_route_selection' });
    expect(studentAlertService.getAlerts('socket-1')).toHaveLength(0);
  });

  it('registers the alert when the trigger stop is immediately before the start stop', async () => {
    prisma.route.findUnique.mockResolvedValue({
      id: 'route-1',
      name: 'Route 1',
      stops: [
        { id: 'stop-1', name: 'First Stop', order: 1 },
        { id: 'stop-2', name: 'Second Stop', order: 2 },
        { id: 'stop-3', name: 'Third Stop', order: 3 },
        { id: 'stop-4', name: 'Fourth Stop', order: 4 },
      ],
    });

    const result = await gateway.handleRegisterStudentAlert(
      {
        routeId: 'route-1',
        startStopName: 'Third Stop',
        endStopName: 'Fourth Stop',
        triggerStopName: 'Second Stop',
        triggerStopOrder: 2,
      },
      {
        id: 'socket-1',
        emit: jest.fn(),
      } as never,
    );

    expect(result.status).toBe('registered');
    expect(studentAlertService.getAlerts('socket-1')).toHaveLength(1);
    expect(studentAlertService.getAlerts('socket-1')[0].triggerStopName).toBe('Second Stop');
  });
});