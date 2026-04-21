---
phase: 01-backend-review
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/src/app.controller.ts
  - backend/src/routes/routes.service.ts
  - backend/src/routes/routes.controller.ts
  - backend/src/prisma/prisma.service.ts
  - backend/src/email/email.service.ts
  - backend/src/app.service.ts
  - backend/src/auth/roles.guard.ts
  - backend/src/tracking/bus-simulator.service.ts
  - backend/src/tracking/tracking.service.ts
  - backend/src/tracking/tracking.gateway.ts
  - backend/src/tracking/clustering.service.ts
  - backend/src/tracking/crowd.controller.ts
  - backend/src/tracking/crowd.service.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-20T00:00:00Z  
**Depth:** standard  
**Files Reviewed:** 13  
**Status:** issues_found

## Summary

The backend source files were reviewed for bugs, security vulnerabilities, and code quality issues. Most code follows good practices, but several issues were identified:

- **Critical:** Hardcoded email service credentials risk if environment variables are not set.
- **Warnings:** Missing error handling in async methods, and possible unhandled promise rejections.
- **Info:** Minor code quality suggestions, such as improving type safety and logging.

## Critical Issues

### CR-01: Potential Hardcoded Credentials in Email Service

**File:** backend/src/email/email.service.ts:7-13
**Issue:** The email transporter uses environment variables for credentials, but if these are not set, the code may fail or expose sensitive information. There is no validation or fallback.
**Fix:**
```typescript
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
```

## Warnings

### WR-01: Missing Error Handling in Email Sending

**File:** backend/src/email/email.service.ts:15-20
**Issue:** The `sendOtp` method does not handle errors from `sendMail`, which could cause unhandled promise rejections.
**Fix:**
```typescript
async sendOtp(email: string, otp: string) {
  try {
    await this.transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your account - SUBIS',
      html: `<h3>Your OTP is: ${otp}</h3><p>Valid for 5 minutes</p>`,
    });
  } catch (error) {
    // Log and handle error appropriately
    throw new Error('Failed to send OTP email');
  }
}
```

### WR-02: No Error Handling in PrismaService onModuleInit

**File:** backend/src/prisma/prisma.service.ts:8-11
**Issue:** The `onModuleInit` method does not handle connection errors, which could cause the application to crash if the database is unavailable.
**Fix:**
```typescript
async onModuleInit() {
  try {
    await this.$connect();
  } catch (error) {
    // Log error and handle gracefully
    throw new Error('Failed to connect to database');
  }
}
```

## Info

### IN-01: Type Safety in RolesGuard

**File:** backend/src/auth/roles.guard.ts:18-28
**Issue:** The code assumes `user.role` is always a string. If undefined, it may throw an error.
**Fix:**
```typescript
const userRole = typeof user.role === 'string' ? user.role.toLowerCase() : '';
```

### IN-02: Logging for Critical Operations

**File:** backend/src/tracking/bus-simulator.service.ts: seedRoutes, initializeDemoScenario
**Issue:** Critical operations (seeding, initialization) should have more robust logging for easier debugging and monitoring.
**Fix:**
Add more detailed logs for success/failure in these methods.

---

_Reviewed: 2026-04-20T00:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
