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
import { PrismaService } from '../prisma/prisma.service';
import { StudentAlertService } from './student-alert.service';

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
    private readonly prisma: PrismaService,
    private readonly studentAlertService: StudentAlertService,
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

    const alerts = this.studentAlertService.getAlerts(client.id);
    if (alerts.length > 0) {
      client.emit('student_alerts_snapshot', alerts);
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
      this.emitStudentAlerts(updateResult);
    }
    return { status: 'success' };
  }

  @SubscribeMessage('register_student_alert')
  async handleRegisterStudentAlert(
    @MessageBody()
    data: {
      routeId: string;
      routeName?: string;
      startStopName: string;
      endStopName: string;
      triggerStopName: string;
      triggerStopOrder: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const route = await this.prisma.route.findUnique({
      where: { id: data.routeId },
      include: {
        stops: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!route || route.stops.length === 0) {
      return { status: 'not_found' };
    }

    const normalize = (value: string) => value.toLowerCase().trim();
    const startIndex = route.stops.findIndex(
      (stop) => normalize(stop.name) === normalize(data.startStopName),
    );
    const endIndex = route.stops.findIndex(
      (stop) => normalize(stop.name) === normalize(data.endStopName),
    );
    const triggerIndex = route.stops.findIndex(
      (stop) => normalize(stop.name) === normalize(data.triggerStopName),
    );

    if (startIndex <= 0 || endIndex <= startIndex || triggerIndex !== startIndex - 1) {
      return { status: 'invalid_route_selection' };
    }

    const triggerStop = route.stops[triggerIndex];
    const alert = this.studentAlertService.registerAlert(client.id, {
      routeId: route.id,
      routeName: route.name,
      startStopName: data.startStopName,
      endStopName: data.endStopName,
      triggerStopName: triggerStop.name,
      triggerStopOrder: triggerStop.order,
    });

    client.emit('student_alerts_snapshot', this.studentAlertService.getAlerts(client.id));

    return { status: 'registered', alert };
  }

  @SubscribeMessage('clear_student_alert')
  handleClearStudentAlert(
    @MessageBody() data: { alertId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const cleared = this.studentAlertService.clearAlert(client.id, data.alertId);
    client.emit('student_alerts_snapshot', this.studentAlertService.getAlerts(client.id));

    return { status: cleared ? 'cleared' : 'not_found' };
  }

  handleDisconnect(client: Socket) {
    this.studentAlertService.clearSocket(client.id);
  }

  private emitStudentAlerts(busUpdate: {
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
  }) {
    const triggers = this.studentAlertService.evaluateBusUpdate(busUpdate);

    for (const trigger of triggers) {
      this.server.to(trigger.socketId).emit('student_alert_triggered', {
        alert: trigger.alert,
        bus: busUpdate,
        message: trigger.message,
        etaMinutes: trigger.arrivalEtaMinutes,
      });
    }
  }
}
