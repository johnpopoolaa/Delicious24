import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === 'GET' || req.method === 'HEAD') {
      return next.handle();
    }
    const body = req.body as { idempotency_key?: string } | undefined;
    const key =
      (req.headers['idempotency-key'] as string | undefined) ??
      (req.headers['x-idempotency-key'] as string | undefined) ??
      body?.idempotency_key;
    if (!key || typeof key !== 'string') {
      return next.handle();
    }

    // NestJS defaults: POST → 201, everything else → 200
    const inferredStatus = req.method === 'POST' ? 201 : 200;
    const route = `${req.method}:${req.path}`;
    const res = context.switchToHttp().getResponse<Response>();

    return from(
      this.prisma.idempotencyRequest.findUnique({
        where: { key_route: { key, route } },
      }),
    ).pipe(
      mergeMap((existing) => {
        if (existing) {
          // Replay with the originally stored status code
          res.status(existing.statusCode);
          return of(existing.responseBody);
        }
        return next.handle().pipe(
          mergeMap((bodyResponse) =>
            from(
              (async () => {
                try {
                  await this.prisma.idempotencyRequest.create({
                    data: {
                      key,
                      route,
                      responseBody: bodyResponse as object,
                      statusCode: inferredStatus,
                    },
                  });
                } catch (e: unknown) {
                  const err = e as { code?: string };
                  if (err?.code === 'P2002') {
                    const r = await this.prisma.idempotencyRequest.findUnique({
                      where: { key_route: { key, route } },
                    });
                    if (r) {
                      res.status(r.statusCode);
                      return r.responseBody;
                    }
                  }
                  throw e;
                }
                return bodyResponse;
              })(),
            ),
          ),
        );
      }),
    );
  }
}
