import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Email credentials are not set in environment variables');
    }
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendOtp(email: string, otp: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify your account - SUBIS',
        html: `<h3>Your OTP is: ${otp}</h3><p>Valid for 5 minutes</p>`,
      });
    } catch (error) {
      throw new Error(
        `Failed to send OTP email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
