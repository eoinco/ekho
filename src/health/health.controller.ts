import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService, private db: TypeOrmHealthIndicator) {}

  // TODO add jwt validation for authorised users
  @Get()
  @HealthCheck()
  readiness() {
    return this.health.check([async () => this.db.pingCheck('database', { timeout: 300 })]);
  }
}
