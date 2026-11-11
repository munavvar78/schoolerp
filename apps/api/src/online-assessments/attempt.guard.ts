import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { appConfig } from '../config.js';

export type AttemptTokenPayload = {
  purpose: 'online_attempt';
  attemptId: string;
  assessmentId: string;
  organizationId: string;
  campusId: string;
};

@Injectable()
export class OnlineAttemptGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      attempt?: AttemptTokenPayload;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing attempt token');
    }
    try {
      const payload = await this.jwt.verifyAsync<AttemptTokenPayload>(header.slice(7), {
        secret: appConfig.jwtAccessSecret,
      });
      if (payload.purpose !== 'online_attempt' || !payload.attemptId) {
        throw new UnauthorizedException('Invalid attempt token');
      }
      request.attempt = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid attempt token');
    }
  }
}
