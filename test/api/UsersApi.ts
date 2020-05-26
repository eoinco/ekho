import { INestApplication } from '@nestjs/common';
import * as supertest from 'supertest';

export class UsersApi {
  constructor(private readonly app: INestApplication, private readonly testId: string) {}

  async createUser(name: string, id: string, token: string) {
    const response = await supertest
      .agent(this.app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: name + this.testId, userId: id, accessToken: token })
      .expect(201);
    return response.body;
  }
}
