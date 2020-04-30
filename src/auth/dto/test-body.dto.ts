import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from 'type-graphql';

@InputType()
export default class TestDataDto {
  @Field()
  @ApiProperty({ description: 'User Id' })
  userId: string;

  @Field()
  @ApiProperty({ description: 'Other Data' })
  otherData: string;
}
