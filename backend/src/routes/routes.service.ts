import {
  Injectable,
  NotFoundException,
  BadRequestException, // Keep BadRequestException as it's used in other methods
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {} // Added 'readonly'
  //get all active routes with their stops ordered by stop order
  async getAllActiveRoutes() {
    return this.prisma.route.findMany({
      where: { status: 'ACTIVE' },
      include: {
        stops: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }
  //add route stop with validation
  async addStop(
    routeId: string,
    data: { name: string; latitude: number; longitude: number; order: number },
  ) {
    const { name, latitude, longitude, order } = data;

    // 1️⃣ Check if route exists
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
    });
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    // 2️⃣ Check if stop order already exists for this route
    const existingStop = await this.prisma.stop.findFirst({
      where: { routeId, order },
    });
    if (existingStop) {
      throw new BadRequestException(
        `Stop with order ${order} already exists for this route`,
      );
    }

    // 3️⃣ Create the stop
    const stop = await this.prisma.stop.create({
      data: {
        routeId,
        name,
        latitude,
        longitude,
        order,
      },
    });

    return stop;
  }
  //create route with validation
  async createRoute(name: string) {
    if (!name) {
      console.error('Route name is required');
      throw new BadRequestException('Route name is required');
    }

    const route = await this.prisma.route.create({
      data: {
        name,
      },
    });

    return route;
  }
  //update route with validation
  async updateRoute(
    routeId: string,
    data: { name?: string; color?: string | null },
  ) {
    const existingRoute = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!existingRoute) {
      throw new NotFoundException('Route not found');
    }

    const payload: { name?: string; color?: string | null } = {};

    if (typeof data.name === 'string') {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Route name cannot be empty');
      }
      payload.name = trimmedName;
    }

    if (typeof data.color !== 'undefined') {
      payload.color = data.color || '#3B82F6';
    }

    return this.prisma.route.update({
      where: { id: routeId },
      data: payload,
      include: {
        stops: {
          orderBy: { order: 'asc' },
        },
      },
    });
  }
  //update stop with validation
  async updateStop(
    stopId: string,
    data: {
      name?: string;
      latitude?: number;
      longitude?: number;
      order?: number;
    },
  ) {
    const existingStop = await this.prisma.stop.findUnique({
      where: { id: stopId },
    });

    if (!existingStop) {
      throw new NotFoundException('Stop not found');
    }

    if (typeof data.order === 'number' && data.order !== existingStop.order) {
      const conflictingStop = await this.prisma.stop.findFirst({
        where: {
          routeId: existingStop.routeId,
          order: data.order,
          id: { not: stopId },
        },
      });

      if (conflictingStop) {
        throw new BadRequestException(
          `Stop with order ${data.order} already exists for this route`,
        );
      }
    }

    const payload: {
      name?: string;
      latitude?: number;
      longitude?: number;
      order?: number;
    } = {};

    if (typeof data.name === 'string') {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Stop name cannot be empty');
      }
      payload.name = trimmedName;
    }

    if (typeof data.latitude === 'number') {
      payload.latitude = data.latitude;
    }

    if (typeof data.longitude === 'number') {
      payload.longitude = data.longitude;
    }

    if (typeof data.order === 'number') {
      payload.order = data.order;
    }

    return this.prisma.stop.update({
      where: { id: stopId },
      data: payload,
      include: {
        route: true,
      },
    });
  }

  async deleteRoute(routeId: string) {
    const existingRoute = await this.prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!existingRoute) {
      throw new NotFoundException('Route not found');
    }

    return this.prisma.route.delete({
      where: { id: routeId },
    });
  }

  async deleteStop(stopId: string) {
    const existingStop = await this.prisma.stop.findUnique({
      where: { id: stopId },
    });

    if (!existingStop) {
      throw new NotFoundException('Stop not found');
    }

    return this.prisma.stop.delete({
      where: { id: stopId },
    });
  }
}
