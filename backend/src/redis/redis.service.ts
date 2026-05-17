import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private redisClient: Redis) {
    this.redisClient.on('error', (err) =>
      this.logger.error('Redis error:', err),
    );
  }

  /**
   * Set OTP in Redis with TTL
   * @param email User email
   * @param hashedOtp Hashed OTP value
   * @param ttlSeconds Time to live (default 300s = 5 minutes)
   */
  async setOtp(
    email: string,
    hashedOtp: string,
    ttlSeconds = 300,
  ): Promise<void> {
    const key = `otp:${email}`;
    await this.redisClient.set(key, hashedOtp, 'EX', ttlSeconds);
    this.logger.debug(`OTP set for ${email}, TTL: ${ttlSeconds}s`);
  }

  /**
   * Get and atomically delete OTP (prevents replay attacks)
   * @param email User email
   * @returns Hashed OTP or null if not found/expired
   */
  async getAndDeleteOtp(email: string): Promise<string | null> {
    const key = `otp:${email}`;
    // Try to use GETDEL if available (Redis 6.2+)
    try {
      const value = await this.redisClient.getdel(key);
      if (value) this.logger.debug(`OTP retrieved and deleted for ${email}`);
      return value;
    } catch (err) {
      // Fallback for older Redis: GET then DEL
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug(
        'GETDEL not available, using GET+DEL fallback',
        message,
      );
      const value = await this.redisClient.get(key);
      if (value) {
        await this.redisClient.del(key);
        this.logger.debug(`OTP retrieved and deleted (fallback) for ${email}`);
      }
      return value;
    }
  }

  /**
   * Get OTP without deleting it.
   * @param email User email
   * @returns Hashed OTP or null if not found/expired
   */
  async getOtp(email: string): Promise<string | null> {
    const key = `otp:${email}`;
    return this.redisClient.get(key);
  }

  /**
   * Delete OTP after successful verification.
   * @param email User email
   */
  async deleteOtp(email: string): Promise<void> {
    const key = `otp:${email}`;
    await this.redisClient.del(key);
    this.logger.debug(`OTP deleted for ${email}`);
  }

  /**
   * Increment OTP attempt counter
   * @param email User email
   * @returns New attempt count
   */
  async incrementAttempts(email: string): Promise<number> {
    const key = `otp-attempts:${email}`;
    const attempts = await this.redisClient.incr(key);
    // Set expiry on first attempt
    if (attempts === 1) {
      await this.redisClient.expire(key, 300);
    }
    this.logger.debug(`OTP attempt ${attempts} for ${email}`);
    return attempts;
  }

  /**
   * Reset OTP attempt counter
   * @param email User email
   */
  async resetAttempts(email: string): Promise<void> {
    const key = `otp-attempts:${email}`;
    await this.redisClient.del(key);
    this.logger.debug(`OTP attempts reset for ${email}`);
  }

  /**
   * Get attempt count without incrementing
   * @param email User email
   * @returns Current attempt count or 0
   */
  async getAttempts(email: string): Promise<number> {
    const key = `otp-attempts:${email}`;
    const attempts = await this.redisClient.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  /**
   * Delete a key
   * @param key Redis key
   */
  async delete(key: string): Promise<void> {
    await this.redisClient.del(key);
    this.logger.debug(`Deleted key: ${key}`);
  }

  /**
   * Check if key exists
   * @param key Redis key
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  /**
   * Publish message to channel (for real-time updates)
   * @param channel Channel name
   * @param message Message to publish
   */
  async publish(channel: string, message: string): Promise<void> {
    await this.redisClient.publish(channel, message);
    this.logger.debug(`Published to channel ${channel}`);
  }

  /**
   * Health check
   */
  async ping(): Promise<string> {
    return this.redisClient.ping();
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.redisClient.quit();
    this.logger.log('Redis connection closed');
  }
}
