import { Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const RedisProvider: Provider = {
  provide: 'REDIS_CLIENT',
  useFactory: () => {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    return new Redis(redisUrl);
  },
};
