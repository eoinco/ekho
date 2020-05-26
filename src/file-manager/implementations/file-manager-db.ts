import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CryptographyService } from '../../cryptography/cryptography.service';
import { FileManager } from '../file-manager.interface';
import { FileChunk } from './file-db.entity';

@Injectable()
export class DBFileManager implements FileManager {
  private readonly BASE_64 = 'base64';

  constructor(
    private readonly fileChunkRepository: Repository<FileChunk>,
    private readonly cryptoService: CryptographyService,
  ) {}

  async retrieve(id: string): Promise<string> {
    try {
      Logger.debug(`DBFileManager.retrieve: getting ${id} from DB`);
      const file = await this.fileChunkRepository.findOne({ address: id });
      Logger.debug(`DBFileManager.retrieve: got ${id} from DB`);
      return file.chunkData; // TODO encoding
    } catch (e) {
      throw e;
    }
  }

  async store(data: string): Promise<string> {
    Logger.debug(`DBFileManager.store: storing data in DB`);
    const chunk = new FileChunk();
    chunk.chunkData = data;

    chunk.address = this.cryptoService.hash(chunk.chunkData);

    // if we already have this address in the filechunk store, then just return it
    const existingFile = await this.fileChunkRepository.findOne({ address: chunk.address });
    if (existingFile) {
      return existingFile.address;
    }

    // otherwise save the chunk to the database
    try {
      const savedChunk = await this.fileChunkRepository.save(chunk);
      if (savedChunk) {
        Logger.debug(`DBFileManager.store: file ${chunk.address} shared via DB`);
        return chunk.address;
      }
    } catch (err) {
      Logger.debug(`DBFileManager.store: error saving file to DB. error: ${err}`);
    }
  }
}
