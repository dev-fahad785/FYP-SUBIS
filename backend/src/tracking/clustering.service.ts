import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAlertService } from './student-alert.service';

interface StudentLocation {
  userId: string;
  name?: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: Date;
  isSimulated?: boolean;
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
  speed: number;
  memberUserIds: string[];
  payload: ClusterBusPayload;
}

interface ClusterBusPayload {
  busId: string;
  id: string;
  plateNumber: string;
  routeId: string;
  routeName: string;
  latitude: number;
  longitude: number;
  speed: number;
  crowdLevel: string;
  lastUpdate: Date;
  isSimulated: boolean;
  isCrowdsourced: boolean;
  studentsInCluster: number;
  probabilityScore: number;
  probabilityLabel: string;
  clusterRadiusMeters: number;
  etas: unknown[];
  currentStop: null;
  nextStop: null;
  nextStopEtaMinutes: null;
  nearestStop: null;
  nearestStopDistanceKm: null;
}
interface StudentAlert {
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
}
@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  // In-memory store of the latest location for each student
  private activeStudents: Map<string, StudentLocation> = new Map();
  // In-memory store of active clusters (buses created from clustering)
  private activeClusters: Map<string, ActiveClusterState> = new Map();

  constructor(
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TrackingGateway))
    private readonly trackingGateway: TrackingGateway,
    private readonly studentAlertService: StudentAlertService
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
   * Returns all active in-memory clusters (crowdsourced buses)
   */
  public getActiveClusters() {
    const now = new Date();
    const CLUSTER_TIMEOUT_MS = 300000; // 5 minutes
    const activeClusters: ClusterBusPayload[] = [];

    for (const [busId, cluster] of this.activeClusters.entries()) {
      if (now.getTime() - cluster.lastSeenAt.getTime() > CLUSTER_TIMEOUT_MS) {
        this.activeClusters.delete(busId);
        this.logger.debug(
          `[MEMORY_CLEANUP] Expired cluster ${busId} removed from memory`
        );
        continue;
      }
      activeClusters.push(cluster.payload);
    }
    return activeClusters;
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
        this.activeStudents.delete(userId);
        continue;
      }
      // Ignore walkers and stationary users.
      if (!loc.isSimulated && loc.speed > 15) {
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
    const MIN_STUDENTS_FOR_BUS = 10;

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
          candidate.longitude
        );
        const speedDelta = Math.abs(current.speed - candidate.speed);

        if (
          distance <= CLUSTER_RADIUS_METERS &&
          speedDelta <= SPEED_TOLERANCE_KMH
        ) {
          currentCluster.push(candidate);
          visited.add(candidate.userId);
        }
      }

      clusters.push(currentCluster);
    }

    // 3. Process the found clusters - KEEP ONLY IN MEMORY, DON'T SAVE TO DB
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

        const memberUserIds = cluster.map((student) => student.userId);

        const dynamicBusId = this.resolveClusterBusId(
          matchedRoute.id,
          avgLat,
          avgLng,
          now,
          memberUserIds,
          avgSpeed
        );

        // Base probability: start at 60, +8 per extra rider above minimum, clamped
        let probabilityScore = Math.min(
          98,
          Math.max(
            60,
            Math.round(60 + (cluster.length - MIN_STUDENTS_FOR_BUS) * 8)
          )
        );

        // Compute distance from cluster centroid to the matched route (meters)
        const routePath = this.normalizePolyline(matchedRoute.polyline, matchedRoute.stops);
        let nearestDistanceMeters = Number.POSITIVE_INFINITY;
        for (const pt of routePath) {
          const d = this.getDistanceMeters(avgLat, avgLng, pt[0], pt[1]);
          if (d < nearestDistanceMeters) nearestDistanceMeters = d;
        }
        if (!isFinite(nearestDistanceMeters)) nearestDistanceMeters = 1e6;

        // Apply a distance-based penalty: farther from the registered route -> lower confidence.
        // Penalty: 1 percentage point per 10 meters away, capped at 30%. This is tunable.
        const DISTANCE_PENALTY_PER_10M = 1; // percent per 10m
        const DISTANCE_PENALTY_MAX = 30; // percent
        const computedPenalty = Math.min(
          DISTANCE_PENALTY_MAX,
          Math.round(nearestDistanceMeters / 10) * DISTANCE_PENALTY_PER_10M
        );

        probabilityScore = Math.max(40, probabilityScore - computedPenalty);

        this.logger.log(
          `[CLUSTER_DETECTED] Bus: ${dynamicBusId} | Route: ${matchedRoute.id} | Students: ${cluster.length} | Probability: ${probabilityScore}% | Speed: ${avgSpeed.toFixed(1)} km/h`
        );

        // Create bus object WITHOUT saving to database
        const busPayload: ClusterBusPayload = {
          busId: dynamicBusId,
          id: dynamicBusId,
          plateNumber: `CLUSTER-${cluster.length}`,
          routeId: matchedRoute.id,
          routeName: matchedRoute.name,
          latitude: avgLat,
          longitude: avgLng,
          speed: avgSpeed,
          crowdLevel: 'MEDIUM',
          lastUpdate: now,
          isSimulated: false,
          isCrowdsourced: true,
          studentsInCluster: cluster.length,
          probabilityScore,
          probabilityLabel: this.describeProbability(probabilityScore),
          clusterRadiusMeters: CLUSTER_RADIUS_METERS,
          etas: [], // Could calculate if needed
          currentStop: null,
          nextStop: null,
          nextStopEtaMinutes: null,
          nearestStop: null,
          nearestStopDistanceKm: null,
        };

        this.activeClusters.set(dynamicBusId, {
          busId: dynamicBusId,
          routeId: matchedRoute.id,
          latitude: avgLat,
          longitude: avgLng,
          lastSeenAt: now,
          speed: avgSpeed,
          memberUserIds,
          payload: busPayload,
        });

        // Emit ONLY via WebSocket, DON'T save to database
        this.trackingGateway.server.emit('bus_moved', busPayload);
        this.emitStudentAlerts(busPayload);

        // Remove students from active tracking and notify clients that the
        // riders are now represented by the detected bus instead of markers.
        for (const student of cluster) {
          this.activeStudents.delete(student.userId);
          this.trackingGateway.server.emit('student_removed', {
            userId: student.userId,
            busId: dynamicBusId,
            routeId: matchedRoute.id,
          });
        }
      }
    }
  }

  private emitStudentAlerts(busUpdate: StudentAlert) {
    const triggers = this.studentAlertService.evaluateBusUpdate(busUpdate);

    for (const trigger of triggers) {
      this.trackingGateway.server
        .to(trigger.socketId)
        .emit('student_alert_triggered', {
          alert: trigger.alert,
          bus: busUpdate,
          message: trigger.message,
          etaMinutes: trigger.arrivalEtaMinutes,
        });
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
    }>
  ): RouteCandidate | null {
    let bestMatch: null | { route: RouteCandidate; distanceMeters: number } =
      null;

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
          point[1]
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
    stops: Array<{ latitude: number; longitude: number }>
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
    memberUserIds: string[],
    speed: number
  ) {
    const CLUSTER_TIMEOUT_MS = 300000; // 5 minutes
    const BASE_REUSE_DISTANCE_METERS = 250;
    const MIN_MEMBER_OVERLAP = 3;

    // Try to reuse existing cluster within distance threshold
    for (const [busId, cluster] of this.activeClusters.entries()) {
      if (now.getTime() - cluster.lastSeenAt.getTime() > CLUSTER_TIMEOUT_MS) {
        this.activeClusters.delete(busId);
        this.logger.debug(`Cluster ${busId} expired and removed from memory`);
        continue;
      }

      if (cluster.routeId !== routeId) {
        continue;
      }

      const distanceMeters = this.getDistanceMeters(
        latitude,
        longitude,
        cluster.latitude,
        cluster.longitude
      );

      const overlapCount = memberUserIds.filter((userId) =>
        cluster.memberUserIds.includes(userId)
      ).length;
      const elapsedSeconds = Math.max(
        1,
        (now.getTime() - cluster.lastSeenAt.getTime()) / 1000
      );
      const speedMetersPerSecond = Math.max(speed, cluster.speed, 15) / 3.6;
      const dynamicReuseDistance =
        BASE_REUSE_DISTANCE_METERS + speedMetersPerSecond * elapsedSeconds * 2;

      if (
        overlapCount >= MIN_MEMBER_OVERLAP ||
        distanceMeters <= dynamicReuseDistance
      ) {
        this.logger.debug(
          `[CLUSTER_REUSED] Bus ${busId} for cluster ${distanceMeters.toFixed(0)}m away with ${overlapCount} shared riders`
        );
        return busId;
      }
    }

    // Create new cluster ID (kept only in memory)
    const busId = `CROWD_BUS_${routeId}_${now.getTime()}`;
    this.logger.debug(`[CLUSTER_CREATED] New in-memory cluster ${busId}`);
    return busId;
  }

  private getDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
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

  private describeProbability(probabilityScore: number) {
    if (probabilityScore >= 85) return 'High confidence';
    if (probabilityScore >= 70) return 'Likely bus';
    return 'Possible bus';
  }
}
