import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('logs')
  getLogs(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('busId') busId?: string,
    @Query('source') source?: 'BUS' | 'USER',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const parsedPage = page ? Number.parseInt(page, 10) : 1;
    const parsedPageSize = pageSize ? Number.parseInt(pageSize, 10) : 20;

    return this.adminService.getLogs({
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      pageSize: Number.isNaN(parsedPageSize) ? 20 : parsedPageSize,
      busId,
      source,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('analytics')
  getAnalytics(@Query('range') range?: 'daily' | 'weekly') {
    return this.adminService.getAnalytics(
      range === 'weekly' ? 'weekly' : 'daily',
    );
  }

  @Get('geocode')
  geocode(@Query('query') query?: string) {
    return this.adminService.searchLocations(query ?? '');
  }
}
