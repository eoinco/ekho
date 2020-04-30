import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/users.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private userService: UsersService, private jwtService: JwtService) {}

  public async validate(userId: string): Promise<User> {
    return await this.userService.findById(userId);
  }

  // TODO get best practices for dealing with this in production
  // potential back door!
  public async getToken(userId: string): Promise<any | { status: number }> {
    Logger.debug(`generating token for ${userId}`);
    if (!userId) {
      return { status: 404 };
    }

    const payload = { userId };
    let accessToken: string;

    try {
      accessToken = this.jwtService.sign(payload, {
        algorithm: 'RS256',
        expiresIn: process.env.AUTH_EXPIRY,
      });
    } catch (e) {
      Logger.debug('Error signing token ', e.message);
      throw new UnauthorizedException();
    }
    return { access_token: accessToken };
  }
}
