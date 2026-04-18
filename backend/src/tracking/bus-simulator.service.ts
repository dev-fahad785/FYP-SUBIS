import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClusteringService } from './clustering.service';
import { IUB_ROUTES } from './simulator-data';

/**
 * Automatically simulates Student locations for crowdsourced bus clustering.
 * Also simulates real buses moving along routes with dynamic ETA and stops.
 */
@Injectable()
export class BusSimulatorService implements OnModuleInit {
  private readonly logger = new Logger(BusSimulatorService.name);

  // Islamia University approx coordinates
  private baseLat = 29.3783;
  private baseLng = 71.7738;

  // Active simulated students
  private activeStudents = [
    // A group of 5 students moving fast together (will be clustered into a bus)
    {
      id: 'STUDENT_001',
      lat: 29.375,
      lng: 71.77,
      speed: 30,
      angle: 0,
      group: 'A',
    },
    {
      id: 'STUDENT_002',
      lat: 29.37501,
      lng: 71.77001,
      speed: 30,
      angle: 0,
      group: 'A',
    },
    {
      id: 'STUDENT_003',
      lat: 29.37499,
      lng: 71.76999,
      speed: 30,
      angle: 0,
      group: 'A',
    },
    {
      id: 'STUDENT_004',
      lat: 29.375,
      lng: 71.77002,
      speed: 30,
      angle: 0,
      group: 'A',
    },
    {
      id: 'STUDENT_007',
      lat: 29.37502,
      lng: 71.77003,
      speed: 31,
      angle: 0,
      group: 'A',
    },

    // Random slow students (walkers / sitters) that shouldn't be clustered into a bus
    {
      id: 'STUDENT_005',
      lat: 29.38,
      lng: 71.775,
      speed: 4,
      angle: 90,
      group: 'B',
    },
    {
      id: 'STUDENT_006',
      lat: 29.37,
      lng: 71.78,
      speed: 0,
      angle: 180,
      group: 'C',
    },
  ];

  // Simulated real buses on routes
  private simulatedBuses = [
    { busId: 'BUS_001', routeId: 'ROUTE_1', currentStopIndex: 0, speed: 40 },
    { busId: 'BUS_002', routeId: 'ROUTE_2', currentStopIndex: 0, speed: 35 },
    { busId: 'BUS_003', routeId: 'ROUTE_3', currentStopIndex: 0, speed: 38 },
  ];

  constructor(
    private readonly trackingService: TrackingService,
    private readonly trackingGateway: TrackingGateway,
    private readonly prisma: PrismaService,
    private readonly clusteringService: ClusteringService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Real Campus Routes for Simulator...');

    for (const routeData of IUB_ROUTES) {
      // 1. Convert stop objects to array of [lat, lng] for the Polyline
      const polyline = routeData.stops.map((s) => [s.lat, s.lng]);

      // 2. Upsert the Route with the Polyline and Color
      await this.prisma.route.upsert({
        where: { id: routeData.id },
        update: {
          polyline: polyline,
          color: routeData.color,
        },
        create: {
          id: routeData.id,
          name: routeData.name,
          color: routeData.color,
          polyline: polyline,
          status: 'ACTIVE',
        },
      });

      // 3. Upsert the stops for this route
      for (let i = 0; i < routeData.stops.length; i++) {
        const stop = routeData.stops[i];
        const stopId = `${routeData.id}_STOP_${i}`;

        await this.prisma.stop.upsert({
          where: { id: stopId },
          update: {
            name: stop.name,
            latitude: stop.lat,
            longitude: stop.lng,
            order: i + 1,
          },
          create: {
            id: stopId,
            routeId: routeData.id,
            name: stop.name,
            latitude: stop.lat,
            longitude: stop.lng,
            order: i + 1,
          },
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async simulateMovement() {
    // 1. Simulate individual student movement (for clustering demo)
    for (const student of this.activeStudents) {
      if (student.speed > 0) {
        // Move the student slightly
        const speedDegrees = student.speed * 0.0001;
        student.angle += 10;
        student.lat =
          this.baseLat +
          Math.sin((student.angle * Math.PI) / 180) * speedDegrees * 5;
        student.lng =
          this.baseLng +
          Math.cos((student.angle * Math.PI) / 180) * speedDegrees * 5;
      }

      // Submit position to clustering service
      this.clusteringService.addStudentLocation({
        userId: student.id,
        latitude: student.lat,
        longitude: student.lng,
        speed: student.speed,
        timestamp: new Date(),
      });
    }

    // 2. Simulate real buses moving along routes
    for (const bus of this.simulatedBuses) {
      await this.simulateBusMovement(bus);
    }
  }

  /**
   * Simulate a bus moving along its route from stop to stop
   */
  private async simulateBusMovement(bus: any) {
    try {
      // Get route with stops
      const route = await this.prisma.route.findUnique({
        where: { id: bus.routeId },
        include: {
          stops: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!route || route.stops.length === 0) return;

      const stops = route.stops;
      // If bus has reached the last stop, keep it there and stop moving
      if (bus.currentStopIndex >= stops.length - 1) {
        const lastStop = stops[stops.length - 1];
        const prevStop = stops[stops.length - 2] || lastStop;
        const updateResult = await this.trackingService.processGPSUpdate({
          busId: bus.busId,
          routeId: bus.routeId,
          latitude: lastStop.latitude,
          longitude: lastStop.longitude,
          speed: 0,
        });
        const broadcastPayload = {
          ...updateResult,
          isSimulated: true,
          currentStop: lastStop.name,
          nextStop: null,
          prevStop: prevStop.name,
          speed: 0,
          eta: 0,
        };
        this.trackingGateway.server.emit('bus_moved', broadcastPayload);
        this.logger.debug(`Bus ${bus.busId} stopped at final stop: ${lastStop.name}`);
        return;
      }

      // Move between stops sequentially
      const currentStop = stops[bus.currentStopIndex];
      const nextStop = stops[bus.currentStopIndex + 1];
      const prevStop = bus.currentStopIndex > 0 ? stops[bus.currentStopIndex - 1] : null;

      // Interpolate position between current and next stop (simulate movement)
      const progress = (Math.floor(Date.now() / 5000) % 10) / 10; // 0-1 over 50 seconds per stop

      const busLatitude =
        currentStop.latitude +
        (nextStop.latitude - currentStop.latitude) * progress;
      const busLongitude =
        currentStop.longitude +
        (nextStop.longitude - currentStop.longitude) * progress;

      // Calculate ETA (simple linear estimate)
      const distance = Math.sqrt(
        Math.pow(nextStop.latitude - busLatitude, 2) +
        Math.pow(nextStop.longitude - busLongitude, 2)
      );
      // Assume speed in km/h, convert to degrees per second (rough estimate)
      const speedDegreesPerSec = bus.speed * 0.00001;
      const eta = speedDegreesPerSec > 0 ? distance / speedDegreesPerSec : 0;

      // Move to next stop when progress completes
      if (progress > 0.99) {
        bus.currentStopIndex = bus.currentStopIndex + 1;
      }

      // Call TrackingService to update bus position with dynamic ETA
      const updateResult = await this.trackingService.processGPSUpdate({
        busId: bus.busId,
        routeId: bus.routeId,
        latitude: busLatitude,
        longitude: busLongitude,
        speed: bus.speed,
      });

      // Broadcast bus movement with simulator flag and extra info
      const broadcastPayload = {
        ...updateResult,
        isSimulated: true,
        currentStop: currentStop.name,
        nextStop: nextStop.name,
        prevStop: prevStop ? prevStop.name : null,
        speed: bus.speed,
        eta: Math.round(eta),
      };

      this.trackingGateway.server.emit('bus_moved', broadcastPayload);

      this.logger.debug(
        `Bus ${bus.busId} moving: ${currentStop.name} → ${nextStop.name} (Progress: ${(progress * 100).toFixed(0)}%, ETA: ${Math.round(eta)}s)`
      );
    } catch (error) {
      this.logger.error(`Error simulating bus ${bus.busId}:`, error);
    }
  }
}
