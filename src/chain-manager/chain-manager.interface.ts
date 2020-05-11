import EkhoEventDto from 'src/events/dto/ekhoevent.dto';

export interface ChainManager {
  listen(): Promise<void>; // TODO
  emitEkho(ekho: EkhoEventDto): Promise<string>; // TODO
}
