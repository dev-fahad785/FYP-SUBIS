import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

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
        `Stop with order ${order} already exists for this route`
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
}
