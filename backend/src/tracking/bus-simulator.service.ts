import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClusteringService } from './clustering.service';
import { IUB_ROUTES } from './simulator-data';
import { StudentAlertService } from './student-alert.service';

interface DemoStudent {
  id: string;
  name: string;
  routeId: string;
  stopIndex: number;
  status: 'waiting' | 'onboard';
  latitude: number;
  longitude: number;
  speed: number;
  offsetLat: number;
  offsetLng: number;
}

interface SimulatedBusState {
  busId: string;
  routeId: string;
  speed: number;
  segmentIndex: number;
  progress: number;
}

interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
}

@Injectable()
export class BusSimulatorService implements OnModuleInit {
  private readonly logger = new Logger(BusSimulatorService.name);

  private demoStudents: DemoStudent[] = [];

  private readonly directBuses: SimulatedBusState[] = [
    {
      busId: 'SIM_BUS_ROUTE_1',
      routeId: 'ROUTE_1',
      speed: 30,
      segmentIndex: 0,
      progress: 0.1,
    },
    {
      busId: 'SIM_BUS_ROUTE_2',
      routeId: 'ROUTE_2',
      speed: 34,
      segmentIndex: 0,
      progress: 0.15,
    },
    {
      busId: 'SIM_BUS_ROUTE_3',
      routeId: 'ROUTE_3',
      speed: 31,
      segmentIndex: 1,
      progress: 0.35,
    },
    {
      busId: 'SIM_BUS_ROUTE_4',
      routeId: 'ROUTE_4',
      speed: 29,
      segmentIndex: 2,
      progress: 0.55,
    },
    {
      busId: 'SIM_BUS_ROUTE_5',
      routeId: 'ROUTE_3',
      speed: 25,
      segmentIndex: 0,
      progress: 0.05,
    },
  ];

  private readonly crowdCarrier: SimulatedBusState = {
    busId: 'SIM_CROWD_ROUTE_1',
    routeId: 'ROUTE_1',
    speed: 32,
    segmentIndex: 0,
    progress: 0.2,
  };

  constructor(
    private readonly trackingService: TrackingService,
    private readonly trackingGateway: TrackingGateway,
    private readonly prisma: PrismaService,
    private readonly clusteringService: ClusteringService,
    private readonly studentAlertService: StudentAlertService,
  ) {}

  async onModuleInit() {
    await this.seedRoutes();
    this.initializeDemoScenario();
    this.logger.log('Demo simulator initialized for viva scenario');
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async simulateMovement() {
    const routeMap = await this.loadRouteMap();

    if (routeMap.size === 0) {
      return;
    }

    const crowdRoute = routeMap.get(this.crowdCarrier.routeId);
    if (crowdRoute) {
      const crowdBusPosition = this.advanceBusAlongRoute(
        this.crowdCarrier,
        crowdRoute.stops
      );
      this.updateDemoStudentsForCrowdBus(routeMap, crowdBusPosition);
    }

    for (const bus of this.directBuses) {
      const route = routeMap.get(bus.routeId);
      if (!route) {
        continue;
      }

      const position = this.advanceBusAlongRoute(bus, route.stops);
      const updateResult = await this.trackingService.processGPSUpdate({
        busId: bus.busId,
        routeId: bus.routeId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: bus.speed,
      });

      this.trackingGateway.server.emit('bus_moved', {
        ...updateResult,
        isSimulated: true,
        simulatedSource: 'direct_bus',
      });
      this.emitStudentAlerts({
        ...updateResult,
        isSimulated: true,
        simulatedSource: 'direct_bus',
      });
    }
  }

  private emitStudentAlerts(busUpdate: {
    busId: string;
    routeId: string;
    routeName?: string;
    currentStop?: string | null;
    nearestStop?: string | null;
    nextStop?: string | null;
    nextStopEtaMinutes?: number | null;
    isSimulated?: boolean;
    isCrowdsourced?: boolean;
    plateNumber?: string;
    simulatedSource?: string;
  }) {
    const triggers = this.studentAlertService.evaluateBusUpdate(busUpdate);

    for (const trigger of triggers) {
      this.trackingGateway.server.to(trigger.socketId).emit('student_alert_triggered', {
        alert: trigger.alert,
        bus: busUpdate,
        message: trigger.message,
        etaMinutes: trigger.arrivalEtaMinutes,
      });
    }
  }

  private async seedRoutes() {
    for (const routeData of IUB_ROUTES) {
      const polyline = routeData.stops.map((stop) => [stop.lat, stop.lng]);

      await this.prisma.route.upsert({
        where: { id: routeData.id },
        update: {
          name: routeData.name,
          color: routeData.color,
          polyline,
          status: 'ACTIVE',
        },
        create: {
          id: routeData.id,
          name: routeData.name,
          color: routeData.color,
          polyline,
          status: 'ACTIVE',
        },
      });

      for (let index = 0; index < routeData.stops.length; index++) {
        const stop = routeData.stops[index];
        const stopId = `${routeData.id}_STOP_${index}`;

        await this.prisma.stop.upsert({
          where: { id: stopId },
          update: {
            name: stop.name,
            latitude: stop.lat,
            longitude: stop.lng,
            order: index + 1,
          },
          create: {
            id: stopId,
            routeId: routeData.id,
            name: stop.name,
            latitude: stop.lat,
            longitude: stop.lng,
            order: index + 1,
          },
        });
      }
    }
  }

  private initializeDemoScenario() {
    const route1Stop0 = IUB_ROUTES.find((route) => route.id === 'ROUTE_1')
      ?.stops[0];
    const route1Stop4 = IUB_ROUTES.find((route) => route.id === 'ROUTE_1')
      ?.stops[4];
    const route3Stop2 = IUB_ROUTES.find((route) => route.id === 'ROUTE_3')
      ?.stops[2];

    if (!route1Stop0 || !route1Stop4 || !route3Stop2) {
      this.logger.warn(
        'Demo scenario could not be initialized because simulator stops are missing'
      );
      return;
    }

    this.demoStudents = [
      ...this.createOnboardGroup('ROUTE_1', route1Stop0.lat, route1Stop0.lng),
      ...this.createWaitingGroup(
        'WAIT_GATE',
        'ROUTE_1',
        4,
        route1Stop4.lat,
        route1Stop4.lng,
        4
      ),
      ...this.createWaitingGroup(
        'WAIT_ROUTE_3',
        'ROUTE_3',
        2,
        route3Stop2.lat,
        route3Stop2.lng,
        3
      ),
    ];
  }

  private createOnboardGroup(
    routeId: string,
    latitude: number,
    longitude: number
  ) {
    return Array.from({ length: 5 }, (_, index) => ({
      id: `ONBOARD_${index + 1}`,
      name: `Passenger ${index + 1}`,
      routeId,
      stopIndex: 0,
      status: 'onboard' as const,
      latitude,
      longitude,
      speed: this.crowdCarrier.speed,
      offsetLat: index * 0.000015,
      offsetLng: index * 0.00001,
    }));
  }

  private createWaitingGroup(
    prefix: string,
    routeId: string,
    stopIndex: number,
    latitude: number,
    longitude: number,
    count: number
  ) {
    return Array.from({ length: count }, (_, index) => ({
      id: `${prefix}_${index + 1}`,
      name: `${routeId} Rider ${index + 1}`,
      routeId,
      stopIndex,
      status: 'waiting' as const,
      latitude,
      longitude,
      speed: 0,
      offsetLat: index * 0.00002,
      offsetLng: index * 0.000015,
    }));
  }

  private async loadRouteMap() {
    const routes = await this.prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: {
        stops: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return new Map(routes.map((route) => [route.id, route]));
  }

  private advanceBusAlongRoute(bus: SimulatedBusState, stops: RouteStop[]) {
    if (stops.length < 2) {
      return {
        latitude: stops[0]?.latitude ?? 29.3783,
        longitude: stops[0]?.longitude ?? 71.7738,
        currentStop: stops[0]?.name ?? null,
        nextStop: null,
      };
    }

    bus.progress += 0.22;
    if (bus.progress >= 1) {
      bus.progress = 0;
      bus.segmentIndex = (bus.segmentIndex + 1) % (stops.length - 1);
    }

    const currentStop = stops[bus.segmentIndex];
    const nextStop = stops[bus.segmentIndex + 1];
    const latitude =
      currentStop.latitude +
      (nextStop.latitude - currentStop.latitude) * bus.progress;
    const longitude =
      currentStop.longitude +
      (nextStop.longitude - currentStop.longitude) * bus.progress;

    return {
      latitude,
      longitude,
      currentStop: currentStop.name,
      nextStop: nextStop.name,
    };
  }

  private updateDemoStudentsForCrowdBus(
    routeMap: Map<string, { stops: RouteStop[] }>,
    crowdBusPosition: {
      latitude: number;
      longitude: number;
      currentStop: string | null;
      nextStop: string | null;
    }
  ) {
    const currentStopIndex = this.crowdCarrier.segmentIndex;

    for (const student of this.demoStudents) {
      if (
        student.routeId === this.crowdCarrier.routeId &&
        student.status === 'waiting'
      ) {
        if (currentStopIndex >= student.stopIndex) {
          student.status = 'onboard';
        }
      }

      if (
        student.status === 'onboard' &&
        student.routeId === this.crowdCarrier.routeId
      ) {
        student.latitude = crowdBusPosition.latitude + student.offsetLat;
        student.longitude = crowdBusPosition.longitude + student.offsetLng;
        student.speed = this.crowdCarrier.speed;

        this.clusteringService.addStudentLocation({
          userId: student.id,
          name: student.name,
          latitude: student.latitude,
          longitude: student.longitude,
          speed: student.speed,
          isSimulated: true,
          timestamp: new Date(),
        });
        continue;
      }

      const stop = routeMap.get(student.routeId)?.stops[student.stopIndex];
      if (!stop) {
        continue;
      }

      student.latitude = stop.latitude + student.offsetLat;
      student.longitude = stop.longitude + student.offsetLng;
      student.speed = 0;

      this.clusteringService.addStudentLocation({
        userId: student.id,
        name: student.name,
        latitude: student.latitude,
        longitude: student.longitude,
        speed: student.speed,
        isSimulated: true,
        timestamp: new Date(),
      });

      this.trackingGateway.server.emit('student_moved', {
        userId: student.id,
        name: student.name,
        latitude: student.latitude,
        longitude: student.longitude,
        speed: 0,
        status: 'waiting',
        isSimulated: true,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
