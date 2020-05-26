import { ApiProperty } from '@nestjs/swagger';
import { Field, InputType } from 'type-graphql';
import { User } from '../entities/users.entity';

@InputType({ description: 'New user name' })
export default class CreateUserDto implements Partial<User> {
  @ApiProperty({ description: 'User Identifier (optional)' })
  userId: string;

  @Field()
  @ApiProperty({ description: 'User name' })
  name: string;

  @ApiProperty({ description: 'Access Token (optional)' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh Token (optional)' })
  refreshToken: string;
}
