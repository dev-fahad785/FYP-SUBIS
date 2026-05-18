import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        console.log('Connected to the database');
        return;
      } catch (err) {
        retries--;
        console.warn(`DB connection failed, retrying... (${retries} left)`);
        await new Promise((res) => setTimeout(res, 3000)); // wait 3s
      }
    }
    throw new Error('Could not connect to database after multiple retries');
  }
}
