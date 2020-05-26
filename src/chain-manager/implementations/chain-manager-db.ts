import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import EkhoEventDto from '../../events/dto/ekhoevent.dto';
import { EkhoEvent } from '../../events/entities/events.entity';
import { EventsService } from '../../events/events.service';
import { ChainManager } from '../chain-manager.interface';

@Injectable()
export class DBChainManager implements ChainManager {
  constructor(private readonly eventService: EventsService) {}

  async listen(): Promise<void> {
    throw new NotImplementedException();
  }

  async emitEkho(ekho: EkhoEventDto): Promise<string> {
    const event = new EkhoEvent();
    event.channelId = ekho.channelIdentifier;
    event.content = ekho.encryptedMessageLink;
    event.signature = ekho.encryptedMessageLinkSignature;
    event.status = 'BATCH';
    event.batchChild = 'awaiting_batch';
    event.batchParent = '';

    try {
      await this.eventService.save(event);
    } catch (err) {
      Logger.debug(`DBFileManager.store: error saving file to DB. error: ${err}`);
    }
    if (event.id) {
      Logger.debug(`DBFileManager.store: file ${event.id} shared via DB`);
      return event.id;
    } else {
      throw new Error('DBFileManager.store: Error saving to DB');
    }
  }
}
