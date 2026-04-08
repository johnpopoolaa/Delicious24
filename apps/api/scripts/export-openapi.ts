import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from '../src/app.module';

async function exportSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Delicious24 API')
    .setDescription('Restaurant credit system — admin backend')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(__dirname, '../openapi.json');
  writeFileSync(outPath, JSON.stringify(document, null, 2));
  // eslint-disable-next-line no-console
  console.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

exportSpec();
