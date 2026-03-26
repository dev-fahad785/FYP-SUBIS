import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CrowdLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrowdService {
  private readonly logger = new Logger(CrowdService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estimates crowd levels for all stops every 5 seconds
   * Counts active users within 50m of each stop from the last 5 minutes
   */
  @Cron('*/5 * * * * *')
  async estimateCrowdForAllStops() {
    try {
      // 1. Fetch all active routes with stops
      const routes = await this.prisma.route.findMany({
        where: { status: 'ACTIVE' },
        include: {
          stops: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (routes.length === 0) {
        return;
      }

      // 2. Fetch recent telemetry (last 5 minutes) from opted-in users
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentTelemetry = await this.prisma.telemetry.findMany({
        where: {
          userId: { not: null },
          timestamp: { gte: fiveMinutesAgo },
          user: {
            locationOptIn: true,
          },
        },
        include: {
          user: true,
        },
      });

      // 3. For each stop, calculate crowd level
      for (const route of routes) {
        for (const stop of route.stops) {
          const nearbyUsers = recentTelemetry.filter((telemetry) => {
            const distanceKm = this.calculateDistance(
              telemetry.latitude,
              telemetry.longitude,
              stop.latitude,
              stop.longitude,
            );
            // 50 meters = 0.05 km
            return distanceKm <= 0.05;
          });

          const crowdLevel = this.getCrowdLevel(nearbyUsers.length);

          // 4. Update stop with new crowd level
          await this.prisma.stop.update({
            where: { id: stop.id },
            data: { crowdLevel },
          });
        }
      }

      this.logger.debug('Crowd estimation completed successfully');
    } catch (error) {
      this.logger.error('Error during crowd estimation:', error);
    }
  }

  /**
   * Get crowd level for a specific stop based on nearby users
   */
  async getCrowdLevelForStop(stopId: string) {
    const stop = await this.prisma.stop.findUnique({
      where: { id: stopId },
    });

    if (!stop) {
      return null;
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentTelemetry = await this.prisma.telemetry.findMany({
      where: {
        userId: { not: null },
        timestamp: { gte: fiveMinutesAgo },
        user: {
          locationOptIn: true,
        },
      },
      include: {
        user: true,
      },
    });

    const nearbyUsers = recentTelemetry.filter((telemetry) => {
      const distanceKm = this.calculateDistance(
        telemetry.latitude,
        telemetry.longitude,
        stop.latitude,
        stop.longitude,
      );
      return distanceKm <= 0.05;
    });

    const crowdLevel = this.getCrowdLevel(nearbyUsers.length);

    return {
      id: stop.id,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      crowdLevel,
      estimatedCount: nearbyUsers.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get all stops with current crowd level data
   */
  async getAllStopsWithCrowdData() {
    const stops = await this.prisma.stop.findMany({
      include: {
        route: true,
      },
      orderBy: [{ routeId: 'asc' }, { order: 'asc' }],
    });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentTelemetry = await this.prisma.telemetry.findMany({
      where: {
        userId: { not: null },
        timestamp: { gte: fiveMinutesAgo },
        user: {
          locationOptIn: true,
        },
      },
      include: {
        user: true,
      },
    });

    return stops.map((stop) => {
      const nearbyUsers = recentTelemetry.filter((telemetry) => {
        const distanceKm = this.calculateDistance(
          telemetry.latitude,
          telemetry.longitude,
          stop.latitude,
          stop.longitude,
        );
        return distanceKm <= 0.05;
      });

      const crowdLevel = this.getCrowdLevel(nearbyUsers.length);

      return {
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        routeId: stop.routeId,
        routeName: stop.route.name,
        crowdLevel,
        estimatedCount: nearbyUsers.length,
        order: stop.order,
        lastUpdated: new Date(),
      };
    });
  }

  /**
   * Determine crowd level based on user count
   * LOW: < 10 users
   * MODERATE: 10-29 users
   * HIGH: >= 30 users
   */
  private getCrowdLevel(userCount: number): CrowdLevel {
    if (userCount < 10) {
      return CrowdLevel.LOW;
    }
    if (userCount < 30) {
      return CrowdLevel.MODERATE;
    }
    return CrowdLevel.HIGH;
  }

  /**
   * Calculate distance between two lat/lng points using Haversine formula
   * Returns distance in kilometers
   */
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

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
