import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // bỏ field không khai báo
      forbidNonWhitelisted: true, // báo lỗi nếu có field lạ
      transform: true, // auto convert type
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestJS Demo API')
      .setDescription('Demo Nest')
      .setVersion('1.0')
      .addBearerAuth()
      .addGlobalParameters({
        in: 'header',
        name: 'x-lang',
        schema: { type: 'string', enum: ['en', 'vn'], default: 'en' },
        description: 'Language',
      })
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
