import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChannelMessage } from '../../channels/entities/channelmessages.entity';

@Entity()
export class EkhoEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  status: string;

  @Column({ nullable: true })
  channelId?: string;

  @Column({ nullable: true })
  content?: string;

  @Column({ nullable: true })
  signature?: string;

  @Column({ nullable: true })
  batchChild?: string;

  @Column({ nullable: true })
  batchParent?: string;

  @Column({ nullable: true })
  txHash?: string;

  @Column({ nullable: true })
  block?: number;

  @CreateDateColumn()
  createdDate: Date;

  @OneToMany(
    type => ChannelMessage,
    channelmessage => channelmessage.ekhoEvent,
  )
  channelmessages: ChannelMessage[];
}
