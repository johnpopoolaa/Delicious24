import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://127.0.0.1:${port}/api`);
}

bootstrap();
