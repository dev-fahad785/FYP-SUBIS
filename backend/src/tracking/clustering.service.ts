import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';

interface StudentLocation {
  userId: string;
  name?: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: Date;
}

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  // In-memory store of the latest location for each student
  private activeStudents: Map<string, StudentLocation> = new Map();

  constructor(
    private readonly trackingService: TrackingService,
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
      // Assuming walking speed is around 5 km/h. > 15 km/h likely means they are in a vehicle.
      if (loc.speed > 15) {
        activeLocations.push(loc);
      }
    }

    if (activeLocations.length === 0) return;

    // 2. Simple Radius Clustering (O(n^2) is fine for small N)
    const CLUSTER_RADIUS_METERS = 30; // Students within 30m of each other are grouped
    const MIN_STUDENTS_FOR_BUS = 3;

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

        if (distance <= CLUSTER_RADIUS_METERS) {
          currentCluster.push(candidate);
          visited.add(candidate.userId);
        }
      }

      clusters.push(currentCluster);
    }

    // 3. Process the found clusters
    let busCounter = 1;
    for (const cluster of clusters) {
      if (cluster.length >= MIN_STUDENTS_FOR_BUS) {
        // Calculate centroid
        const avgLat =
          cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
        const avgLng =
          cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;
        const avgSpeed =
          cluster.reduce((sum, p) => sum + p.speed, 0) / cluster.length;

        // The Bus ID could be tied to the route or a dynamic ID.
        // For now, we dynamically assign an ID. In reality, we'd map it to the closest known Route.
        const dynamicBusId = `CROWD_BUS_${busCounter}`;

        // Let's assume ROUTE_RED for demonstration, or we'd calculate closest route.
        const assumedRouteId = 'ROUTE_RED';

        // Probability is higher the more students there are (cap at 100%)
        const probabilityScore = Math.min(
          100,
          Math.round((cluster.length / 5) * 100),
        );

        this.logger.debug(
          `Found Bus Cluster! ${cluster.length} students. Generated ID: ${dynamicBusId}. Prob: ${probabilityScore}%`,
        );

        // Process through standard tracking flow (this logs telemetry and calculates ETA)
        const updateResult = await this.trackingService.processGPSUpdate({
          busId: dynamicBusId,
          routeId: assumedRouteId,
          latitude: avgLat,
          longitude: avgLng,
          speed: avgSpeed,
        });

        // Add our custom probability data to the broadcast payload
        const broadcastPayload = {
          ...updateResult,
          isCrowdsourced: true,
          studentsInCluster: cluster.length,
          probabilityScore: probabilityScore,
        };

        this.trackingGateway.server.emit('bus_moved', broadcastPayload);
        busCounter++;
      }
    }
  }
}
