import { Field, InputType } from 'type-graphql';

@InputType()
export default class HandshakeDto {
  @Field()
  userId: string;

  @Field()
  contactName: string;
}
