import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false; // No user attached to request
    const userRole =
      typeof user.role === 'string' ? user.role.toLowerCase() : '';
    const roles = requiredRoles.map((r) => r.toLowerCase());
    return roles.includes(userRole);
    // return requiredRoles.includes(user.role);
  }
}
