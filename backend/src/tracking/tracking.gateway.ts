import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TrackingService } from './tracking.service';
import { ClusteringService } from './clustering.service';
import { Inject, forwardRef } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TrackingGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly trackingService: TrackingService,
    @Inject(forwardRef(() => ClusteringService))
    private readonly clusteringService: ClusteringService,
  ) {}

  // When a new client connects, send them the current snapshot of all active students and buses
  async handleConnection(client: Socket) {
    console.log(`[GATEWAY] New client connected: ${client.id}`);

    const activeStudents = this.clusteringService.getActiveStudents();
    if (activeStudents.length > 0) {
      const snapshot = activeStudents.map((s) => ({
        userId: s.userId,
        name: s.name || 'Student',
        latitude: s.latitude,
        longitude: s.longitude,
        speed: s.speed,
        isSimulated: Boolean(s.isSimulated),
        timestamp: s.timestamp.toISOString(),
      }));
      console.log(`[GATEWAY] Sending ${snapshot.length} students to client ${client.id}`);
      client.emit('students_snapshot', snapshot);
    }

    // Get simulated buses from database + active in-memory clusters
    const simulatedBuses = await this.trackingService.getActiveBusSnapshot();
    const inMemoryClusters = this.clusteringService.getActiveClusters();
    const allBuses = [...simulatedBuses, ...inMemoryClusters];

    if (allBuses.length > 0) {
      const simulated = allBuses.filter(b => b.isSimulated).length;
      const crowdsourced = allBuses.filter(b => b.isCrowdsourced).length;
      const other = allBuses.length - simulated - crowdsourced;
      console.log(
        `[GATEWAY] Sending ${allBuses.length} buses to client ${client.id} | Simulated: ${simulated}, Crowdsourced: ${crowdsourced}, Other: ${other}`,
      );
      console.log(`[GATEWAY] Bus IDs: ${allBuses.map(b => b.busId).join(', ')}`);
      client.emit('buses_snapshot', allBuses);
    } else {
      console.log(`[GATEWAY] No active buses to send to client ${client.id}`);
    }
  }

  @SubscribeMessage('update_location')
  async handleLocationUpdate(
    @MessageBody()
    data: {
      busId?: string;
      routeId?: string;
      userId?: string;
      role?: string;
      latitude: number;
      longitude: number;
      speed: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.role === 'STUDENT' && data.userId) {
      const studentPayload = {
        userId: data.userId,
        name: (data as any).name || 'Student',
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        isSimulated: Boolean((data as any).isSimulated),
        timestamp: new Date().toISOString(),
      };

      // It's a crowdsourced student providing telemetry
      this.clusteringService.addStudentLocation({
        userId: studentPayload.userId,
        name: studentPayload.name,
        latitude: studentPayload.latitude,
        longitude: studentPayload.longitude,
        speed: studentPayload.speed,
        isSimulated: studentPayload.isSimulated,
        timestamp: new Date(),
      });

      this.server.emit('student_moved', studentPayload);

      return { status: 'queued for clustering' };
    }

    // It's a direct bus location (e.g., from an actual bus hardware GPS if any remain)
    if (data.busId && data.routeId) {
      const updateResult = await this.trackingService.processGPSUpdate({
        busId: data.busId,
        routeId: data.routeId,
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
      });

      console.log(
        `[BUS_MOVED] Bus ${data.busId} (Simulated: ${updateResult.isSimulated}) moved to Route ${data.routeId}`,
      );
      this.server.emit('bus_moved', updateResult);
    }
    return { status: 'success' };
  }
}
