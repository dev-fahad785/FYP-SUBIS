import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { BusSimulatorService } from './bus-simulator.service';
import { ClusteringService } from './clustering.service';
import { CrowdService } from './crowd.service';
import { CrowdController } from './crowd.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentAlertService } from './student-alert.service';

@Module({
  imports: [PrismaModule],
  controllers: [CrowdController],
  providers: [
    TrackingGateway,
    TrackingService,
    BusSimulatorService,
    ClusteringService,
    CrowdService,
    StudentAlertService,
  ],
})
export class TrackingModule {}
