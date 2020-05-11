import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class FileChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  chunkData: string;
}
