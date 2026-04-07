import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
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
    const route = `${req.method}:${req.path}`;
    return from(
      this.prisma.idempotencyRequest.findUnique({
        where: { key_route: { key, route } },
      }),
    ).pipe(
      mergeMap((existing) => {
        if (existing) {
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
                      statusCode: 200,
                    },
                  });
                } catch (e: unknown) {
                  const err = e as { code?: string };
                  if (err?.code === 'P2002') {
                    const r = await this.prisma.idempotencyRequest.findUnique({
                      where: { key_route: { key, route } },
                    });
                    if (r) return r.responseBody;
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
