import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  // 0.0.0.0 so the port is reachable from outside the container.
  await app.listen(process.env.PORT ?? DEFAULT_PORT, '0.0.0.0');
}
void bootstrap();
