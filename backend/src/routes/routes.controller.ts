import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  async getActiveRoutes() {
    return this.routesService.getAllActiveRoutes();
  }

  @Post(':routeId/stops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async addStop(
    @Param('routeId') routeId: string,
    @Body()
    body: { name: string; latitude: number; longitude: number; order: number },
  ) {
    return this.routesService.addStop(routeId, body);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createRoute(@Body() body: { name: string }) {
    return this.routesService.createRoute(body.name);
  }

  @Patch(':routeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateRoute(
    @Param('routeId') routeId: string,
    @Body() body: { name?: string; color?: string | null },
  ) {
    return this.routesService.updateRoute(routeId, body);
  }

  @Patch('stops/:stopId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateStop(
    @Param('stopId') stopId: string,
    @Body()
    body: {
      name?: string;
      latitude?: number;
      longitude?: number;
      order?: number;
    },
  ) {
    return this.routesService.updateStop(stopId, body);
  }

  @Delete(':routeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteRoute(@Param('routeId') routeId: string) {
    return this.routesService.deleteRoute(routeId);
  }

  @Delete('stops/:stopId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteStop(@Param('stopId') stopId: string) {
    return this.routesService.deleteStop(stopId);
  }

  @Post('search/buses')
  async searchBusesByStops(
    @Body() body: { startStopName: string; endStopName: string },
  ) {
    return this.routesService.searchBusesByStops(
      body.startStopName,
      body.endStopName,
    );
  }
}
