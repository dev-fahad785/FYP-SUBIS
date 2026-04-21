import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';

interface StudentLocation {
  userId: string;
  name?: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: Date;
}

interface RouteCandidate {
  id: string;
  name: string;
  stops: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    order: number;
  }>;
  polyline: Array<[number, number]>;
}

interface ActiveClusterState {
  busId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  lastSeenAt: Date;
}

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  // In-memory store of the latest location for each student
  private activeStudents: Map<string, StudentLocation> = new Map();
  private activeClusters: Map<string, ActiveClusterState> = new Map();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
  ) {}

  /**
   * Called by the Gateway whenever a student's app emits their location.
   */
  public addStudentLocation(data: StudentLocation) {
    this.activeStudents.set(data.userId, data);
  }

  /**
   * Returns all active (non-stale) student locations for snapshot delivery.
   */
  public getActiveStudents(): StudentLocation[] {
    const now = new Date();
    const results: StudentLocation[] = [];
    for (const [userId, loc] of this.activeStudents.entries()) {
      if (now.getTime() - loc.timestamp.getTime() > 60000) {
        this.activeStudents.delete(userId);
        continue;
      }
      results.push(loc);
    }
    return results;
  }

  /**
   * Helper function to calculate distance in meters between two coordinates.
   * Uses a basic Haversine formula.
   */
  private getDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth radius in meters
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * rad) *
        Math.cos(lat2 * rad) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Runs every 5 seconds to analyze student positions and find buses.
   */
  @Cron('*/5 * * * * *') // Every 5 seconds
  async clusterLocations() {
    const now = new Date();
    const activeLocations: StudentLocation[] = [];

    // 1. Filter out stale data (older than 30 seconds) and slow speeds
    for (const [userId, loc] of this.activeStudents.entries()) {
      if (now.getTime() - loc.timestamp.getTime() > 30000) {
        this.activeStudents.delete(userId); // Remove inactive students
        continue;
      }
      // Ignore walkers and stationary users.
      if (loc.speed > 12) {
        activeLocations.push(loc);
      }
    }

    if (activeLocations.length === 0) return;

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

    // 2. Radius + speed clustering
    const CLUSTER_RADIUS_METERS = 45;
    const SPEED_TOLERANCE_KMH = 6;
    const MIN_STUDENTS_FOR_BUS = 5;

    const clusters: StudentLocation[][] = [];
    const visited = new Set<string>();

    for (let i = 0; i < activeLocations.length; i++) {
      const current = activeLocations[i];
      if (visited.has(current.userId)) continue;

      const currentCluster = [current];
      visited.add(current.userId);

      for (let j = i + 1; j < activeLocations.length; j++) {
        const candidate = activeLocations[j];
        if (visited.has(candidate.userId)) continue;

        const distance = this.getDistanceMeters(
          current.latitude,
          current.longitude,
          candidate.latitude,
          candidate.longitude,
        );
        const speedDelta = Math.abs(current.speed - candidate.speed);

        if (distance <= CLUSTER_RADIUS_METERS && speedDelta <= SPEED_TOLERANCE_KMH) {
          currentCluster.push(candidate);
          visited.add(candidate.userId);
        }
      }

      clusters.push(currentCluster);
    }

    // 3. Process the found clusters
    for (const cluster of clusters) {
      if (cluster.length >= MIN_STUDENTS_FOR_BUS) {
        // Calculate centroid
        const avgLat =
          cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
        const avgLng =
          cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;
        const avgSpeed =
          cluster.reduce((sum, p) => sum + p.speed, 0) / cluster.length;

        const matchedRoute = this.findClosestRoute(avgLat, avgLng, routes);
        if (!matchedRoute) {
          continue;
        }

        const dynamicBusId = this.resolveClusterBusId(
          matchedRoute.id,
          avgLat,
          avgLng,
          now,
        );

        const probabilityScore = Math.min(
          98,
          Math.max(60, Math.round(60 + (cluster.length - MIN_STUDENTS_FOR_BUS) * 8)),
        );

        this.logger.debug(
          `Found Bus Cluster! ${cluster.length} students. Bus: ${dynamicBusId}. Route: ${matchedRoute.id}. Prob: ${probabilityScore}%`,
        );

        const updateResult = await this.trackingService.processGPSUpdate({
          busId: dynamicBusId,
          routeId: matchedRoute.id,
          latitude: avgLat,
          longitude: avgLng,
          speed: avgSpeed,
        });

        // Add our custom probability data to the broadcast payload
        const broadcastPayload = {
          ...updateResult,
          isCrowdsourced: true,
          studentsInCluster: cluster.length,
          probabilityScore,
          probabilityLabel: this.describeProbability(probabilityScore),
          clusterRadiusMeters: CLUSTER_RADIUS_METERS,
        };

        this.trackingGateway.server.emit('bus_moved', broadcastPayload);
        for (const student of cluster) {
          this.activeStudents.delete(student.userId);
        }
      }
    }
  }

  private findClosestRoute(
    latitude: number,
    longitude: number,
    routes: Array<{
      id: string;
      name: string;
      stops: Array<{
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        order: number;
      }>;
      polyline: unknown;
    }>,
  ): RouteCandidate | null {
    let bestMatch: null | { route: RouteCandidate; distanceMeters: number } = null;

    for (const route of routes) {
      const pathPoints = this.normalizePolyline(route.polyline, route.stops);
      if (pathPoints.length === 0) {
        continue;
      }

      const distanceMeters = pathPoints.reduce((bestDistance, point) => {
        const pointDistance = this.getDistanceMeters(
          latitude,
          longitude,
          point[0],
          point[1],
        );
        return Math.min(bestDistance, pointDistance);
      }, Number.POSITIVE_INFINITY);

      if (!bestMatch || distanceMeters < bestMatch.distanceMeters) {
        bestMatch = {
          route: {
            id: route.id,
            name: route.name,
            stops: route.stops,
            polyline: pathPoints,
          },
          distanceMeters,
        };
      }
    }

    if (!bestMatch || bestMatch.distanceMeters > 250) {
      return null;
    }

    return bestMatch.route;
  }

  private normalizePolyline(
    polyline: unknown,
    stops: Array<{ latitude: number; longitude: number }>,
  ): Array<[number, number]> {
    if (Array.isArray(polyline)) {
      const points = polyline
        .map((point) => {
          if (
            Array.isArray(point) &&
            point.length >= 2 &&
            typeof point[0] === 'number' &&
            typeof point[1] === 'number'
          ) {
            return [point[0], point[1]] as [number, number];
          }

          return null;
        })
        .filter((point): point is [number, number] => Boolean(point));

      if (points.length > 0) {
        return points;
      }
    }

    return stops.map((stop) => [stop.latitude, stop.longitude]);
  }

  private resolveClusterBusId(
    routeId: string,
    latitude: number,
    longitude: number,
    now: Date,
  ) {
    for (const [busId, cluster] of this.activeClusters.entries()) {
      if (now.getTime() - cluster.lastSeenAt.getTime() > 60000) {
        this.activeClusters.delete(busId);
        continue;
      }

      if (cluster.routeId !== routeId) {
        continue;
      }

      const distanceMeters = this.getDistanceMeters(
        latitude,
        longitude,
        cluster.latitude,
        cluster.longitude,
      );

      if (distanceMeters <= 120) {
        this.activeClusters.set(busId, {
          ...cluster,
          latitude,
          longitude,
          lastSeenAt: now,
        });
        return busId;
      }
    }

    const busId = `CROWD_BUS_${routeId}_${now.getTime()}`;
    this.activeClusters.set(busId, {
      busId,
      routeId,
      latitude,
      longitude,
      lastSeenAt: now,
    });
    return busId;
  }

  private describeProbability(probabilityScore: number) {
    if (probabilityScore >= 85) return 'High confidence';
    if (probabilityScore >= 70) return 'Likely bus';
    return 'Possible bus';
  }
}
