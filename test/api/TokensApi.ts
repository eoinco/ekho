import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';

export class TokensApi {
  constructor(private readonly app: INestApplication, private readonly testId: string) {}

  async createToken(userId: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post(`/auth/test/get-token?userId=${userId}`)
      .expect(201);
    return response.body.access_token;
  }
}
