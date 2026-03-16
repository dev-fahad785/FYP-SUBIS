import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClusteringService } from './clustering.service';
import { IUB_ROUTES } from './simulator-data';

/**
 * Automatically simulates Student locations for crowdsourced bus clustering.
 */
@Injectable()
export class BusSimulatorService implements OnModuleInit {
  private readonly logger = new Logger(BusSimulatorService.name);

  // Islamia University approx coordinates
  private baseLat = 29.3783;
  private baseLng = 71.7738;

  // Active simulated students
  private activeStudents = [
    // A group of 4 students moving fast together (will be clustered into a Bus)
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
  }
}
