import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.BEARER_AUTH_PUBLIC_KEY.replace(/\\n/gm, '\n'),
      passReqToCallback: true,
    });
  }

  async validate(payload: any): Promise<any> {
    return { userId: payload.userId };
  }
}
