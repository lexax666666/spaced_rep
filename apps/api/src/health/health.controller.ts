import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** The process is up. The platform calls this every 30 seconds, so it must not wake the database. */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** The process can also reach the database. Deploys call this once before they count as healthy. */
  @Get('ready')
  async ready() {
    return this.health.check();
  }
}
