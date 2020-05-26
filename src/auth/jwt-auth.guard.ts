import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private configService: ConfigService) {
    super(configService);
  }
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (!request.headers.authorization) {
      return false;
    }

    const requestUser = await this.getRequestUser(request);
    const tokenUser = await this.validateToken(request.headers.authorization);
    request.user = tokenUser;
    if (requestUser === request.user.userId) {
      return true;
    }
    throw new HttpException('Invalid request', HttpStatus.FORBIDDEN);
  }

  async validateToken(auth: string) {
    if (auth.split(' ')[0] !== 'Bearer') {
      throw new HttpException('Invalid token', HttpStatus.FORBIDDEN);
    }
    const token = auth.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.BEARER_AUTH_PUBLIC_KEY.replace(/\\n/gm, '\n'));
      return decoded;
    } catch (err) {
      const message = 'Token error: ' + (err.message || err.name);
      throw new HttpException(message, HttpStatus.FORBIDDEN);
    }
  }

  async getRequestUser(req: any): Promise<string> {
    let userId: string;

    if (req.query.userId) {
      userId = req.query.userId;
    }

    if (req.params.userId) {
      const paramsUserId = req.params.userId;
      if (userId) {
        if (paramsUserId !== userId) {
          throw new HttpException('user mismatch', HttpStatus.FORBIDDEN);
        }
      }
      userId = paramsUserId;
    }

    if (req.body.userId) {
      const bodyUserId = req.body.userId;
      if (userId) {
        if (bodyUserId !== userId) {
          throw new HttpException('user mismatch', HttpStatus.FORBIDDEN);
        }
      }
      userId = bodyUserId;
    }

    if (!userId) {
      throw new HttpException('no userId available', HttpStatus.FORBIDDEN);
    }

    return userId;
  }
}
