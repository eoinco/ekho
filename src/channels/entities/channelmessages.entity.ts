import { Field, ID, ObjectType } from 'type-graphql';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EkhoEvent } from '../../events/entities/events.entity';
import { ChannelMember } from './channelmembers.entity';

@Entity()
@ObjectType()
export class ChannelMessage {
  @Field(type => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field(type => ChannelMember)
  @ManyToOne(
    type => ChannelMember,
    channelMember => channelMember.channelmessages,
  )
  channelMember: ChannelMember;

  @Field()
  @Column()
  messageContents: string;

  @Column({ default: 0 })
  nonce: number;

  @Column({ default: null })
  messageKey: string;

  @ManyToOne(
    type => EkhoEvent,
    event => event.channelmessages,
  )
  ekhoEvent: EkhoEvent;
}
