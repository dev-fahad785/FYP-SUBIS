import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly MAX_OTP_ATTEMPTS = Number(process.env.MAX_OTP_ATTEMPTS ?? 5);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {}

  /**
   * Register user, hash password, generate OTP, store to Redis, send OTP email
   */
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const plainOtp = randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);

    // Create user with isVerified=false
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash: hashedPassword,
        // Note: otp and otpExpiry fields can remain null; they're stored in Redis now but before they were in the database.
      },
    });

    // Store hashed OTP in Redis with 5-minute TTL
    await this.redisService.setOtp(dto.email, hashedOtp, 300);

    // Send plain OTP via email
    await this.emailService.sendOtp(user.email, plainOtp);

    return { message: 'User registered. Verify OTP.' };
  }

  /**
   * Login user and return JWT
   */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const payload = { sub: user.id, role: user.role };
    console.log('JWT Payload:', payload);

    const token = await this.jwtService.signAsync(payload);

    return {
      access_token: token,
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    };
  }

  /**
   * Verify OTP and activate account
   * Uses Redis for OTP storage and attempt tracking
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email');
    }

    // Check attempt count and throttle if exceeded
    const attempts = await this.redisService.getAttempts(dto.email);
    if (attempts >= this.MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException(
        `Too many OTP verification attempts. Try again later.`,
      );
    }

    const storedHashedOtp = await this.redisService.getOtp(dto.email);

    if (!storedHashedOtp) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Compare provided OTP with stored hash
    const isOtpValid = await bcrypt.compare(dto.otp, storedHashedOtp);

    if (!isOtpValid) {
      // Increment attempt counter and check limit
      const newAttempts = await this.redisService.incrementAttempts(dto.email);
      if (newAttempts >= this.MAX_OTP_ATTEMPTS) {
        throw new UnauthorizedException(
          `Too many OTP verification attempts. Try again later.`,
        );
      }
      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid: mark user as verified and reset attempts
    await this.redisService.deleteOtp(dto.email);
    await this.prisma.user.update({
      where: { email: dto.email },
      data: {
        isVerified: true,
        // Keep otp and otpExpiry as null (or remove them in a future migration)
      },
    });

    await this.redisService.resetAttempts(dto.email);

    return { message: 'Account verified successfully' };
  }
}

