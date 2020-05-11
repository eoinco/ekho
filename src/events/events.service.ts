import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getRepository, Repository } from 'typeorm';
import EkhoEventDto from './dto/ekhoevent.dto';
import { EkhoEvent } from './entities/events.entity';

@Injectable()
export class EventsService {
  private readonly BASE_64 = 'base64';
  private readonly HEX_ENCODING = 'hex';
  private readonly BYTES = 'bytes';
  private readonly CHANNEL_ID_BYTES = 8;
  private readonly SIGNATURE_BYTES = 64;

  constructor(
    @InjectRepository(EkhoEvent)
    private readonly eventsRepository: Repository<EkhoEvent>,
  ) {}

  // creates the binary data to store on-chain from an ekho event dto
  async createEkhoFromEvent(event: EkhoEventDto): Promise<Buffer> {
    const temp: Buffer[] = [];

    temp[0] = Buffer.from(event.channelIdentifier, this.BASE_64);
    temp[1] = Buffer.from(event.encryptedMessageLink, this.BASE_64);
    temp[2] = Buffer.from(event.encryptedMessageLinkSignature, this.BASE_64);
    const ekho: Buffer = Buffer.concat(temp);

    return ekho;
  }

  // creates an ekho event dto from raw binary data
  async createEventFromEkho(ekho: Buffer): Promise<EkhoEventDto> {
    const event = new EkhoEventDto();

    event.channelIdentifier = Buffer.from(ekho.slice(0, this.CHANNEL_ID_BYTES)).toString(this.BASE_64);
    event.encryptedMessageLink = Buffer.from(
      ekho.slice(this.CHANNEL_ID_BYTES, ekho.length - this.SIGNATURE_BYTES),
    ).toString(this.BASE_64);
    event.encryptedMessageLinkSignature = Buffer.from(
      ekho.slice(ekho.length - this.SIGNATURE_BYTES, ekho.length),
    ).toString(this.BASE_64);

    return event;
  }

  async getAll(): Promise<EkhoEvent[]> {
    return await this.eventsRepository.find();
  }

  async getOneById(id: number): Promise<EkhoEvent> {
    return await this.eventsRepository.findOneOrFail({ id });
  }

  async getTransactionByChannelId(channelId: string): Promise<EkhoEvent> {
    return await this.eventsRepository.findOne({ where: { channelId } });
  }

  async getByTransactionHash(transactionHash: string): Promise<EkhoEvent> {
    const ekhoEvent: EkhoEvent = await this.eventsRepository.findOne({ txHash: transactionHash });
    return ekhoEvent;
  }

  async save(event: EkhoEvent | { txHash: string; status: string }): Promise<void> {
    await this.eventsRepository.save(event);
  }

  async getLatestBlock(): Promise<number> {
    const cachedBlocks = await getRepository(EkhoEvent)
      .createQueryBuilder('Block')
      .select('MAX("block")', 'max')
      .getRawOne();

    if (!cachedBlocks.max) {
      cachedBlocks.max = 0;
    }
    return cachedBlocks.max;
  }

  async markEventAsProcessed(id: number): Promise<boolean> {
    Logger.debug('marking event as processed.  id: ', id.toString());

    const myEvent = await this.getOneById(id);
    await this.save(myEvent);
    return true;
  }

  async getFirstUnprocessedEvent(): Promise<EkhoEventDto> {
    Logger.debug('looking for unprocessed blockchain event.');

    const firstUnprocessedEvent = await getRepository(EkhoEvent)
      .createQueryBuilder('EkhoEvent')
      .select('MIN(EkhoEvent.id)', 'id')
      .addSelect(['EkhoEvent.channelId, EkhoEvent.content, EkhoEvent.signature'])
      .groupBy('EkhoEvent.id')
      .where('EkhoEvent.processed = false')
      .orderBy('EkhoEvent.id', 'ASC')
      .getRawOne();

    if (!firstUnprocessedEvent) {
      return null;
    } else {
      Logger.debug('one event found, eventid: ', firstUnprocessedEvent.id);
      const newEvent = new EkhoEventDto();
      newEvent.eventIdentifier = firstUnprocessedEvent.id;
      newEvent.channelIdentifier = firstUnprocessedEvent.channelId;
      newEvent.encryptedMessageLink = firstUnprocessedEvent.content;
      newEvent.encryptedMessageLinkSignature = firstUnprocessedEvent.signature;

      return newEvent;
    }
  }
}
