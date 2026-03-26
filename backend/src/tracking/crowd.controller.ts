import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { CrowdService } from './crowd.service';

@Controller('tracking/crowd')
export class CrowdController {
  constructor(private readonly crowdService: CrowdService) {}

  /**
   * GET /tracking/crowd/stops
   * Returns all stops with current crowd level estimates
   */
  @Get('stops')
  async getAllStopsWithCrowd() {
    const stops = await this.crowdService.getAllStopsWithCrowdData();
    return {
      success: true,
      data: stops,
      timestamp: new Date(),
    };
  }

  /**
   * GET /tracking/crowd/stops/:stopId
   * Returns specific stop with current crowd level estimate
   */
  @Get('stops/:stopId')
  async getStopCrowd(@Param('stopId') stopId: string) {
    const stop = await this.crowdService.getCrowdLevelForStop(stopId);

    if (!stop) {
      throw new NotFoundException(`Stop with ID ${stopId} not found`);
    }

    return {
      success: true,
      data: stop,
      timestamp: new Date(),
    };
  }
}
