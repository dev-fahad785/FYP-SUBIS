import {
  BadRequestException,
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoutesService } from './routes.service';
type AddStopDto = {
  name: string;
  latitude: number;
  longitude: number;
  order: number;
};

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}
  @Post(':routeId/stops')
  async addStop(
    @Param('routeId') routeId: string,
    @Body()
    body: { name: string; latitude: number; longitude: number; order: number },
  ) {
    return this.routesService.addStop(routeId, body);
  }
  @Post()
  async createRoute(@Body() body: { name: string }) {
    return this.routesService.createRoute(body.name);
  }
}
