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
    const {
      busId,
      routeId,
      latitude,
      longitude,
      speed,
      crowdLevel = CrowdLevel.LOW,
    } = data;

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
    const etas: Array<{
      stopId: string;
      stopName: string;
      distanceKm: string;
      estimatedMinutes: number;
      order: number;
    }> = [];
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
          order: stop.order,
        });
      }
    }

    const stopContext = this.deriveStopContext(
      bus.route?.stops || [],
      latitude,
      longitude,
      etas,
    );

    return {
      busId: bus.id,
      id: bus.id,
      plateNumber: bus.plateNumber,
      routeId: bus.routeId,
      routeName: bus.route?.name ?? 'Unknown route',
      latitude: bus.latitude,
      longitude: bus.longitude,
      speed: bus.speed,
      crowdLevel: bus.crowdLevel,
      lastUpdate: bus.lastUpdate,
      etas,
      currentStop: stopContext.currentStop,
      nextStop: stopContext.nextStop,
      nextStopEtaMinutes: stopContext.nextStopEtaMinutes,
      nearestStop: stopContext.nearestStop,
      nearestStopDistanceKm: stopContext.nearestStopDistanceKm,
    };
  }

  async getActiveBusSnapshot() {
    // Only return buses updated in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const buses = await this.prisma.bus.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        updatedAt: { gte: fiveMinutesAgo },
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
      orderBy: { updatedAt: 'desc' },
    });

    return buses.map((bus) => {
      const etas = (bus.route?.stops || []).map((stop) => {
        const distanceKm = this.calculateDistance(
          bus.latitude ?? 0,
          bus.longitude ?? 0,
          stop.latitude,
          stop.longitude,
        );

        return {
          stopId: stop.id,
          stopName: stop.name,
          distanceKm: distanceKm.toFixed(2),
          estimatedMinutes: Math.ceil(distanceKm * 3),
          order: stop.order,
        };
      });

      const stopContext = this.deriveStopContext(
        bus.route?.stops || [],
        bus.latitude ?? 0,
        bus.longitude ?? 0,
        etas,
      );

      return {
        id: bus.id,
        busId: bus.id,
        plateNumber: bus.plateNumber,
        routeId: bus.routeId,
        routeName: bus.route?.name ?? 'Unknown route',
        latitude: bus.latitude,
        longitude: bus.longitude,
        speed: bus.speed,
        crowdLevel: bus.crowdLevel,
        lastUpdate: bus.lastUpdate,
        etas,
        currentStop: stopContext.currentStop,
        nextStop: stopContext.nextStop,
        nextStopEtaMinutes: stopContext.nextStopEtaMinutes,
        nearestStop: stopContext.nearestStop,
        nearestStopDistanceKm: stopContext.nearestStopDistanceKm,
      };
    });
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

  private deriveStopContext(
    stops: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      order: number;
    }>,
    latitude: number,
    longitude: number,
    etas: Array<{
      stopId: string;
      stopName: string;
      distanceKm: string;
      estimatedMinutes: number;
      order: number;
    }>,
  ) {
    if (!stops.length) {
      return {
        currentStop: null,
        nextStop: null,
        nextStopEtaMinutes: null,
        nearestStop: null,
        nearestStopDistanceKm: null,
      };
    }

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const nearestStop = sortedStops.reduce(
      (best, stop) => {
        const distanceKm = this.calculateDistance(
          latitude,
          longitude,
          stop.latitude,
          stop.longitude,
        );

        if (!best || distanceKm < best.distanceKm) {
          return {
            stop,
            distanceKm,
          };
        }

        return best;
      },
      null as null | { stop: (typeof sortedStops)[number]; distanceKm: number },
    );

    const nearestIndex = nearestStop
      ? sortedStops.findIndex((stop) => stop.id === nearestStop.stop.id)
      : -1;
    const isAtStop = Boolean(nearestStop && nearestStop.distanceKm <= 0.08);
    const currentStop = isAtStop ? (nearestStop?.stop.name ?? null) : null;
    const nextStopCandidate =
      nearestIndex >= 0
        ? sortedStops[
            Math.min(nearestIndex + (isAtStop ? 1 : 0), sortedStops.length - 1)
          ]
        : null;
    const nextStopEta = etas.find(
      (eta) => eta.stopId === nextStopCandidate?.id,
    );

    return {
      currentStop,
      nextStop: nextStopCandidate?.name ?? null,
      nextStopEtaMinutes: nextStopEta?.estimatedMinutes ?? null,
      nearestStop: nearestStop?.stop.name ?? null,
      nearestStopDistanceKm: nearestStop
        ? nearestStop.distanceKm.toFixed(2)
        : null,
    };
  }
}
