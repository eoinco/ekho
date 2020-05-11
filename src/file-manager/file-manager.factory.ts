import { FactoryProvider } from '@nestjs/common/interfaces';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import IpfsClient from 'ipfs-http-client';
import { Repository } from 'typeorm';
import { FileManager } from './file-manager.interface';
import { FileChunk } from './implementations/file-db.entity';
import { DBFileManager } from './implementations/file-manager-db';
import { IpfsFileManager } from './implementations/file-manager-ipfs';

export const fileManagerFactory: FactoryProvider<FileManager> = {
  provide: 'FileManager',
  useFactory: (config: ConfigService, fileChunkRepository: Repository<FileChunk>): FileManager => {
    const builders = {
      ipfs: (): FileManager => {
        const host = config.get<string>('filemanager.ipfs.host');
        const port = config.get<number>('filemanager.ipfs.port');
        const protocol = config.get<string>('filemanager.ipfs.protocol');

        const ipfsClient = new IpfsClient({ host, port, protocol });
        return new IpfsFileManager(ipfsClient);
      },
      db: (): FileManager => {
        return new DBFileManager(fileChunkRepository);
      },
    };
    const type = config.get<string>('filemanager.type');
    const builder = builders[type];
    if (!builder) {
      throw Error(
        `Unexpected file-manager.type value: ${type ? type : 'undefined (missing FILE_MANAGER_TYPE in .env)'}`,
      );
    }
    return builder();
  },
  inject: [ConfigService, getRepositoryToken(FileChunk)],
};
