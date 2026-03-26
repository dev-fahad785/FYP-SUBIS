import { Injectable, Logger } from '@nestjs/common';
import { CrowdLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async processGPSUpdate(data: {
    busId: string;
    routeId: string;
    latitude: number;
    longitude: number;
    speed: number;
    crowdLevel?: CrowdLevel;
  }) {
    const { busId, routeId, latitude, longitude, speed, crowdLevel = CrowdLevel.LOW } = data;

    // 1. Update the Bus current state (first, to ensure it exists for foreign keys)
    const bus = await this.prisma.bus.upsert({
      where: { id: busId },
      update: {
        latitude,
        longitude,
        speed,
        crowdLevel,
        routeId,
        lastUpdate: new Date(),
      },
      create: {
        id: busId,
        plateNumber: `BUS-${Math.floor(Math.random() * 10000)}`,
        routeId,
        latitude,
        longitude,
        speed,
        crowdLevel,
        lastUpdate: new Date(),
      },
      include: {
        route: {
          include: {
            stops: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    // 2. Log telemetry data (now safe since Bus is guaranteed to exist)
    await this.prisma.telemetry.create({
      data: {
        busId,
        latitude,
        longitude,
        speed,
      },
    });

    // 3. Simple ETA Calculation (Straight line distance / speed)
    // Note: In a production environment with OSM, we would use a routing engine (e.g. OSRM).
    // Here we will use a basic Haversine distance calculation to return mock ETAs.
    const etas = [];
    if (bus.route && bus.route.stops.length > 0) {
      for (const stop of bus.route.stops) {
        const distanceKm = this.calculateDistance(
          latitude,
          longitude,
          stop.latitude,
          stop.longitude,
        );

        // Simple heuristic: 1 km takes approx 3 mins (20km/h average city speed)
        // If distance is very small, we assume it reached the stop.
        let estimatedMinutes = Math.ceil(distanceKm * 3);
        if (estimatedMinutes < 0) estimatedMinutes = 0;

        etas.push({
          stopId: stop.id,
          stopName: stop.name,
          distanceKm: distanceKm.toFixed(2),
          estimatedMinutes,
        });
      }
    }

    return {
      busId: bus.id,
      routeId: bus.routeId,
      latitude: bus.latitude,
      longitude: bus.longitude,
      speed: bus.speed,
      crowdLevel: bus.crowdLevel,
      lastUpdate: bus.lastUpdate,
      etas,
    };
  }

  // Haversine formula to calculate distance between two lat/lng points in km
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
