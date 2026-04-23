import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const apiKey = process.env.API_KEY;
    if (!apiKey) return true; // guard is opt-in; if no key configured, pass through

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-api-key'];
    if (provided !== apiKey) {
      throw new UnauthorizedException({ error: 'INVALID_API_KEY', message: 'Missing or invalid API key' });
    }
    return true;
  }
}
