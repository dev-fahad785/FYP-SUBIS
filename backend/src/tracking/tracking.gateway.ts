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

  // When a new client connects, send them the current snapshot of all active students
  async handleConnection(client: Socket) {
    const activeStudents = this.clusteringService.getActiveStudents();
    if (activeStudents.length > 0) {
      const snapshot = activeStudents.map((s) => ({
        userId: s.userId,
        name: s.name || 'Student',
        latitude: s.latitude,
        longitude: s.longitude,
        speed: s.speed,
        timestamp: s.timestamp.toISOString(),
      }));
      client.emit('students_snapshot', snapshot);
    }

    const activeBuses = await this.trackingService.getActiveBusSnapshot();
    if (activeBuses.length > 0) {
      client.emit('buses_snapshot', activeBuses);
    }
  }

  @SubscribeMessage('update_location')
  async handleLocationUpdate(
    @MessageBody()
    data: {
      busId?: string; // Optional now, since students don't have this
      routeId?: string; // Optional for students
      userId?: string; // Student providing location
      role?: string;
      latitude: number;
      longitude: number;
      speed: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    if (data.role === 'STUDENT' && data.userId) {
      // It's a crowdsourced student providing telemetry
      this.clusteringService.addStudentLocation({
        userId: data.userId,
        name: (data as any).name || 'Student',
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        timestamp: new Date(),
      });

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

      this.server.emit('bus_moved', updateResult);
    }
    return { status: 'success' };
  }
}
