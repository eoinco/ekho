import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { fileManagerFactory } from './file-manager.factory';
import { FileChunk } from './implementations/file-db.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FileChunk])],
  providers: [fileManagerFactory],
  exports: [fileManagerFactory],
})
export class FileManagerModule {}
