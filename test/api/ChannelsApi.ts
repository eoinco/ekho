import { INestApplication } from '@nestjs/common';
import BroadcastChannelLinkDto from 'src/channels/dto/link-broadcastchannel.dto';
import * as supertest from 'supertest';

export class ChannelsApi {
  constructor(private readonly app: INestApplication, private readonly testId: string) {}

  async createChannel(name: string, userId: string, contactId: number, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name}-${this.testId}`, userId, contactId })
      .expect(201);
    return response.body;
  }

  async createChannelMessage(message: string, userId: string, channelId: string, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post('/channels/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageContents: `${message}`, userId: `${userId}`, channelId: `${channelId}` })
      .expect(201);
    return response.body;
  }

  async processEvents(userId, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(`/channels/refresh?userId=${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async getUserMessages(userId, contactId, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(`/channels/message?userId=${userId}&contactId=${contactId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async getContactMessages(userId, contactId, channelId, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(`/channels/message?userId=${userId}&contactId=${contactId}&channelId=${channelId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async createBroadcastChannel(name: string, userId: string, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post('/channels/broadcast')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name}`, userId: `${userId}` })
      .expect(201);
    return response.body;
  }

  async followBroadcast(userId: string, channel: BroadcastChannelLinkDto, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/channels/broadcast/follow/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(channel)
      .expect(201);
    return response.body;
  }

  async createBroadcastChannelListener(name: string, userId: string, contactId: number, key: string, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post('/channels/broadcast/listener')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name}`, userId: `${userId}`, contactId: `${contactId}`, key: `${key}` })
      .expect(201);
    return response.body;
  }
}
