import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private keepAliveInterval: NodeJS.Timeout;

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        console.log('Connected to the database');

        // Ping every 4 minutes to prevent Neon from sleeping
        this.keepAliveInterval = setInterval(
          async () => {
            try {
              await this.$queryRaw`SELECT 1`;
            } catch (e) {
              console.warn('Keep-alive ping failed:', e.message);
            }
          },
          4 * 60 * 1000
        );

        return;
      } catch (err) {
        retries--;
        console.warn(`DB connection failed, retrying... (${retries} left)`);
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    throw new Error('Could not connect to database after multiple retries');
  }

  async onModuleDestroy() {
    clearInterval(this.keepAliveInterval);
    await this.$disconnect();
  }
}
