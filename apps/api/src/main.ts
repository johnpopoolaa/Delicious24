import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const config = new DocumentBuilder()
    .setTitle('Delicious24 API')
    .setDescription('Restaurant credit system — admin backend')
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-actor' }, 'actor')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = parseInt(process.env.API_PORT ?? '3001', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://127.0.0.1:${port}/api`);
  // eslint-disable-next-line no-console
  console.log(`Swagger UI at  http://127.0.0.1:${port}/api/docs`);
}

bootstrap();
