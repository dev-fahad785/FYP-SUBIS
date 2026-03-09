import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, PrismaService]
})
export class RoutesModule {}
