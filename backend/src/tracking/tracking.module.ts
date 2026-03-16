import { Module } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';
import { TrackingService } from './tracking.service';
import { BusSimulatorService } from './bus-simulator.service';
import { ClusteringService } from './clustering.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    TrackingGateway,
    TrackingService,
    BusSimulatorService,
    ClusteringService,
  ],
})
export class TrackingModule {}
