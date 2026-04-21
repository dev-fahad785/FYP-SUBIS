import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      throw new Error(
        `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
