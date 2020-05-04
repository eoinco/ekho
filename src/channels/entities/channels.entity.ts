import { Field, ID, ObjectType } from 'type-graphql';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChannelMember } from './channelmembers.entity';

@Entity()
@ObjectType()
export class Channel {
  @Field(type => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  name: string;

  @Field()
  @Column()
  channelKey: string;

  @Field(type => [ChannelMember])
  @OneToMany(
    type => ChannelMember,
    channelmember => channelmember.channel,
  )
  channelmembers: ChannelMember[];
}
