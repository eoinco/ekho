import { ApiProperty } from '@nestjs/swagger';

export class FileChunkDto {
  @ApiProperty({ description: 'Content' })
  content: string;
}
