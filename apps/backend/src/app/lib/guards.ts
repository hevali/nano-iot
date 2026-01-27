import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';

import { getAuthHeader } from './auth';
import type { TypedConfigService } from './config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest() as Request;
    const res = context.switchToHttp().getResponse() as Response;

    const auth = getAuthHeader(req);
    if (!auth) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException();
    }

    const [user, hash] = this.configService.getOrThrow<string>('APP_INITIAL_USER').split(':');
    const match = await bcrypt.compare(auth.password, hash);
    if (!match || user !== auth.user) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException();
    }

    return true;
  }
}
