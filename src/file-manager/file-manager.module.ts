import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptographyModule } from '../cryptography/cryptography.module';
import { fileManagerFactory } from './file-manager.factory';
import { FileChunk } from './implementations/file-db.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileChunk]), CryptographyModule],
  providers: [fileManagerFactory],
  exports: [fileManagerFactory],
})
export class FileManagerModule {}
