import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import type { TypedConfigService } from './config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest() as Request;
    const res = context.switchToHttp().getResponse() as Response;

    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    if (!login || !password) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException();
    }

    const [user, hash] = this.configService.getOrThrow<string>('APP_INITIAL_USER').split(':');
    const match = await bcrypt.compare(password, hash);
    if (!match || user !== login) {
      res.setHeader('WWW-Authenticate', 'Basic');
      throw new UnauthorizedException();
    }

    return true;
  }
}
