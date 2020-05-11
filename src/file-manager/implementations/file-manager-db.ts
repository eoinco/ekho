import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FileManager } from '../file-manager.interface';
import { FileChunk } from './file-db.entity';

@Injectable()
export class DBFileManager implements FileManager {
  constructor(private readonly fileChunkRepository: Repository<FileChunk>) {}

  async retrieve(id: string): Promise<string> {
    try {
      Logger.debug(`DBFileManager.retrieve: getting ${id} from DB`);
      const file = await this.fileChunkRepository.findOne({ id });
      Logger.debug(`DBFileManager.retrieve: got ${id} from IPFS`);
      return file.chunkData; // TODO encoding
    } catch (e) {
      throw e;
    }
  }

  async store(data: string): Promise<string> {
    const chunk = new FileChunk();
    chunk.chunkData = data;

    try {
      await this.fileChunkRepository.save(chunk);
    } catch (err) {
      Logger.debug(`DBFileManager.store: error saving file to DB. error: ${err}`);
    }
    if (chunk.id) {
      Logger.debug(`DBFileManager.store: file ${chunk.id} shared via DB`);
      return chunk.id;
    } else {
      throw new Error('DBFileManager.store: Error saving to DB');
    }
  }
}
