import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { CrowdLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BAHAWALPUR_BOUNDS = {
  west: 71.57,
  south: 29.25,
  east: 71.78,
  north: 29.47,
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  //search stop location for adding in routes
  async searchLocations(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      throw new BadRequestException('Search query is required');
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set(
      'q',
      `${normalizedQuery}, Bahawalpur, Punjab, Pakistan`
    );
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'pk');
    url.searchParams.set(
      'viewbox',
      `${BAHAWALPUR_BOUNDS.west},${BAHAWALPUR_BOUNDS.north},${BAHAWALPUR_BOUNDS.east},${BAHAWALPUR_BOUNDS.south}`
    );
    url.searchParams.set('bounded', '1');

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'SUBIS Admin Dashboard/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new BadGatewayException('Location search service is unavailable');
      }

      const payload = (await response.json()) as Array<{
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
        type?: string;
      }>;

      const results = payload
        .map((item) => ({
          id: String(item.place_id),
          label: item.display_name,
          latitude: Number.parseFloat(item.lat),
          longitude: Number.parseFloat(item.lon),
          type: item.type ?? 'location',
        }))
        .filter(
          (item) =>
            item.label.toLowerCase().includes('bahawalpur') &&
            item.longitude >= BAHAWALPUR_BOUNDS.west &&
            item.longitude <= BAHAWALPUR_BOUNDS.east &&
            item.latitude >= BAHAWALPUR_BOUNDS.south &&
            item.latitude <= BAHAWALPUR_BOUNDS.north
        );

      return {
        query: normalizedQuery,
        locality: 'Bahawalpur',
        results,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      throw new BadGatewayException(
        'Unable to search for that location right now'
      );
    }
  }
  //get overview data for admin dashboard
  async getOverview() {
    const [routes, buses, telemetryCount, crowdStops] = await Promise.all([
      this.prisma.route.findMany({
        where: { status: 'ACTIVE' },
        include: {
          stops: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.bus.findMany({
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
      }),
      this.prisma.telemetry.count(),
      this.prisma.stop.findMany({
        where: {
          crowdLevel: {
            in: [CrowdLevel.MODERATE, CrowdLevel.HIGH],
          },
        },
        include: {
          route: true,
        },
        orderBy: [{ crowdLevel: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
      }),
    ]);

    const activeBuses = buses.filter(
      (bus) => bus.latitude !== null && bus.longitude !== null,
    );
    const now = Date.now();

    const alerts = [
      ...activeBuses
        .filter((bus) => {
          if (!bus.lastUpdate) {
            return true;
          }
          return now - bus.lastUpdate.getTime() > 5 * 60 * 1000;
        })
        .map((bus) => ({
          type: 'BUS_STALE',
          severity: 'high',
          title: `Bus ${bus.plateNumber} not responding`,
          description: bus.lastUpdate
            ? `Last update ${this.formatRelativeMinutes(now - bus.lastUpdate.getTime())}`
            : 'This bus has no recorded update yet.',
          busId: bus.id,
        })),
      ...crowdStops.map((stop) => ({
        type: 'STOP_CROWD',
        severity: stop.crowdLevel === CrowdLevel.HIGH ? 'medium' : 'low',
        title: `${stop.name} crowd level ${stop.crowdLevel.toLowerCase()}`,
        description: `${stop.route.name} is reporting elevated crowd conditions.`,
        stopId: stop.id,
      })),
    ].slice(0, 8);

    return {
      summary: {
        activeBusCount: activeBuses.length,
        routeCount: routes.length,
        stopCount: routes.reduce(
          (count, route) => count + route.stops.length,
          0,
        ),
        telemetryCount,
      },
      buses: activeBuses.map((bus) => ({
        id: bus.id,
        busId: bus.id,
        plateNumber: bus.plateNumber,
        latitude: bus.latitude,
        longitude: bus.longitude,
        speed: bus.speed,
        crowdLevel: bus.crowdLevel,
        lastUpdate: bus.lastUpdate,
        routeId: bus.routeId,
        routeName: bus.route?.name ?? 'Unassigned',
      })),
      routes,
      alerts,
      crowdStops: crowdStops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        routeName: stop.route.name,
        crowdLevel: stop.crowdLevel,
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
      generatedAt: new Date(),
    };
  }
  //get logs with filters for admin dashboard
  async getLogs(params: {
    page: number;
    pageSize: number;
    busId?: string;
    source?: 'BUS' | 'USER';
    startDate?: Date;
    endDate?: Date;
  }) {
    const { page, pageSize, busId, source, startDate, endDate } = params;

    const where: Prisma.TelemetryWhereInput = {};

    if (busId) {
      where.busId = busId;
    }

    if (source === 'BUS') {
      where.busId = { not: null };
    }

    if (source === 'USER') {
      where.userId = { not: null };
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.telemetry.findMany({
        where,
        include: {
          bus: {
            include: {
              route: true,
            },
          },
          user: true,
        },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.telemetry.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        timestamp: item.timestamp,
        latitude: item.latitude,
        longitude: item.longitude,
        speed: item.speed,
        source: item.busId ? 'BUS' : 'USER',
        busId: item.busId,
        busPlateNumber: item.bus?.plateNumber ?? null,
        routeName: item.bus?.route?.name ?? null,
        userId: item.userId,
        userName: item.user?.name ?? null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
  //analytics for admin dashboard
  async getAnalytics(range: 'daily' | 'weekly') {
    const now = new Date();
    const startDate =
      range === 'daily'
        ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [telemetry, crowdedStops, activeBuses, totalRoutes] =
      await Promise.all([
        this.prisma.telemetry.findMany({
          where: {
            timestamp: {
              gte: startDate,
            },
          },
          orderBy: { timestamp: 'asc' },
        }),
        this.prisma.stop.findMany({
          include: {
            route: true,
          },
          orderBy: [{ crowdLevel: 'desc' }, { updatedAt: 'desc' }],
          take: 8,
        }),
        this.prisma.bus.count({
          where: {
            latitude: { not: null },
            longitude: { not: null },
          },
        }),
        this.prisma.route.count({
          where: { status: 'ACTIVE' },
        }),
      ]);

    const buckets =
      range === 'daily'
        ? this.buildDailyBuckets(telemetry, now)
        : this.buildWeeklyBuckets(telemetry, now);

    return {
      range,
      summary: {
        totalTelemetry: telemetry.length,
        busTelemetry: telemetry.filter((item) => item.busId).length,
        userTelemetry: telemetry.filter((item) => item.userId).length,
        activeBuses,
        activeRoutes: totalRoutes,
      },
      usageSeries: buckets,
      crowdRankings: crowdedStops.map((stop) => ({
        id: stop.id,
        stopName: stop.name,
        routeName: stop.route.name,
        crowdLevel: stop.crowdLevel,
        latitude: stop.latitude,
        longitude: stop.longitude,
        intensity: this.getCrowdIntensity(stop.crowdLevel),
      })),
      generatedAt: new Date(),
    };
  }
  //build time buckets for analytics
  private buildDailyBuckets(telemetry: { timestamp: Date }[], now: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
    });

    const buckets = Array.from({ length: 24 }, (_, index) => {
      const bucketDate = new Date(
        now.getTime() - (23 - index) * 60 * 60 * 1000,
      );
      const label = formatter.format(bucketDate);
      return {
        label,
        total: 0,
      };
    });

    telemetry.forEach((item) => {
      const diffHours = Math.floor(
        (now.getTime() - item.timestamp.getTime()) / (60 * 60 * 1000)
      );
      const bucketIndex = 23 - diffHours;
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].total += 1;
      }
    });

    return buckets;
  }
  //build time buckets for analytics
  private buildWeeklyBuckets(telemetry: { timestamp: Date }[], now: Date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
    });

    const buckets = Array.from({ length: 7 }, (_, index) => {
      const bucketDate = new Date(
        now.getTime() - (6 - index) * 24 * 60 * 60 * 1000
      );
      const label = formatter.format(bucketDate);
      return {
        label,
        total: 0,
      };
    });

    telemetry.forEach((item) => {
      const diffDays = Math.floor(
        (now.getTime() - item.timestamp.getTime()) / (24 * 60 * 60 * 1000)
      );
      const bucketIndex = 6 - diffDays;
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[bucketIndex].total += 1;
      }
    });

    return buckets;
  }
  //convert crowd level to intensity for visualization
  private getCrowdIntensity(crowdLevel: CrowdLevel) {
    switch (crowdLevel) {
      case CrowdLevel.HIGH:
        return 1;
      case CrowdLevel.MODERATE:
        return 0.65;
      default:
        return 0.35;
    }
  }
  //format relative time for bus staleness alert
  private formatRelativeMinutes(milliseconds: number) {
    const minutes = Math.max(1, Math.round(milliseconds / (60 * 1000)));
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
}
