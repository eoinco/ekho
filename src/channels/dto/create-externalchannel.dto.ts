import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from 'type-graphql';

@InputType()
export default class CreateExternalChannelDto {
  @Field()
  @ApiProperty({ description: 'Channel creator' })
  userId: string;
  @ApiProperty({ description: 'Channel name' })
  channelName: string;
  @ApiProperty({ description: 'Contact Name' })
  contactName: string;
  @ApiProperty({ description: 'Contact Identifier' })
  contactIdentifier: string;
  @ApiProperty({ description: 'Contact Public Key' })
  contactPublicKey: string;
  @ApiProperty({ description: 'Contact Shared Secret' })
  channelSharedSecret: string;
}
