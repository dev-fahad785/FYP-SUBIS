import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface StudentJourneyAlertRegistration {
  id: string;
  socketId: string;
  routeId: string;
  routeName: string;
  startStopName: string;
  endStopName: string;
  triggerStopName: string;
  triggerStopOrder: number;
  createdAt: string;
  triggeredBusIds: string[];
}

export interface BusAlertContext {
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

export interface StudentAlertTrigger {
  socketId: string;
  alert: StudentJourneyAlertRegistration;
  bus: BusAlertContext;
  arrivalEtaMinutes: number | null;
  message: string;
}

type StudentJourneyAlertInput = Omit<
  StudentJourneyAlertRegistration,
  'id' | 'socketId' | 'createdAt' | 'triggeredBusIds'
>;

@Injectable()
export class StudentAlertService {
  private readonly alertsBySocket = new Map<
    string,
    StudentJourneyAlertRegistration[]
  >();

  registerAlert(socketId: string, input: StudentJourneyAlertInput) {
    if (!socketId) {
      throw new BadRequestException('Socket connection is required');
    }

    const alert: StudentJourneyAlertRegistration = {
      id: randomUUID(),
      socketId,
      ...input,
      createdAt: new Date().toISOString(),
      triggeredBusIds: [],
    };

    const alerts = this.alertsBySocket.get(socketId) ?? [];
    alerts.push(alert);
    this.alertsBySocket.set(socketId, alerts);

    return alert;
  }

  getAlerts(socketId: string) {
    return [...(this.alertsBySocket.get(socketId) ?? [])];
  }

  clearAlert(socketId: string, alertId: string) {
    const alerts = this.alertsBySocket.get(socketId) ?? [];
    const nextAlerts = alerts.filter((alert) => alert.id !== alertId);
    this.alertsBySocket.set(socketId, nextAlerts);
    return nextAlerts.length !== alerts.length;
  }

  clearSocket(socketId: string) {
    this.alertsBySocket.delete(socketId);
  }

  evaluateBusUpdate(bus: BusAlertContext): StudentAlertTrigger[] {
    const triggers: StudentAlertTrigger[] = [];
    const normalizedCurrent = this.normalizeStopName(
      bus.currentStop ?? bus.nearestStop ?? '',
    );

    if (!normalizedCurrent) {
      return triggers;
    }

    for (const [socketId, alerts] of this.alertsBySocket.entries()) {
      for (const alert of alerts) {
        if (alert.routeId !== bus.routeId) {
          continue;
        }

        if (alert.triggeredBusIds.includes(bus.busId)) {
          continue;
        }

        if (
          normalizedCurrent !== this.normalizeStopName(alert.triggerStopName)
        ) {
          continue;
        }

        alert.triggeredBusIds.push(bus.busId);
        triggers.push({
          socketId,
          alert,
          bus,
          arrivalEtaMinutes: bus.nextStopEtaMinutes ?? null,
          message: `${bus.plateNumber || bus.busId || 'A bus'} is about to reach ${alert.startStopName}.`,
        });
      }
    }

    return triggers;
  }

  private normalizeStopName(name: string) {
    return name.toLowerCase().trim();
  }
}
