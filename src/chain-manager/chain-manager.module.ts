import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { chainManagerFactory } from './chain-manager.factory';

@Module({
  imports: [EventsModule],
  providers: [chainManagerFactory],
  exports: [chainManagerFactory],
})
export class ChainManagerModule {}
