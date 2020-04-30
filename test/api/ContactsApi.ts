import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';

export class ContactsApi {
  constructor(private readonly app: INestApplication, private readonly testId: string) {}

  async initHandshake(userId: string, contactName: string, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/contacts/generate-init-handshake/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return response.body;
  }

  async acceptInitHandshake(userId, contactName, handshake, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/contacts/accept-init-handshake/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(handshake)
      .expect(201);
    return response.body;
  }

  async replyHandshake(userId, contactName, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/contacts/generate-reply-handshake/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    return response.body;
  }

  async acceptReplyHandshake(userId, contactName, handshake, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/contacts/accept-reply-handshake/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(handshake)
      .expect(201);
    return response.body;
  }

  // via development modules
  async getMasterKey(userId, contactName, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(`/development/generate-master-key/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.text;
  }

  async getContact(userId, contactName, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(`/development/contact/${userId}/${contactName}-${this.testId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async verifySignature(signature, oneuseKey, signingKey) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .get(
        `/development/cryptography/verify-signature` +
          `/${encodeURIComponent(signature)}` +
          `/${encodeURIComponent(oneuseKey)}` +
          `/${encodeURIComponent(signingKey)}`,
      )
      .expect(200);
    return response.body;
  }
}
