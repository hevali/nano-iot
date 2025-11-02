import { Controller, Get, Inject, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';
import session from 'express-session';
import { promisify } from 'util';

import type { TypedConfigService } from '../lib/config';

interface SessionEnd extends session.Session {
  user: unknown | null;
}

@ApiExcludeController()
@Controller('auth')
export class AuthController {
  constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    const redirectTo = this.getRedirectTo(req, '/docs');
    if (req.session.user) {
      // Already logged in
      res.redirect(302, redirectTo);
      return;
    }

    const error = req.query.error
      ? `<div style="color: red">Incorrect username or password</div>`
      : '';
    const html =
      error +
      `<form action="/auth/login?redirectTo=${encodeURIComponent(redirectTo)}" method="post">
Username: <input name="username"><br>
Password: <input name="password" type="password"><br>
<input type="submit" text="Login"></form>`;

    res.clearCookie('connect.sid').send(html);
  }

  @Post('login')
  async doLogin(@Req() req: Request, @Res() res: Response) {
    const [user, hash] = this.configService.getOrThrow<string>('APP_INITIAL_USER').split(':');
    const match = await bcrypt.compare(req.body.password, hash);

    if (!match || !crypto.timingSafeEqual(Buffer.from(user), Buffer.from(req.body.username))) {
      if (req.accepts('html')) {
        res.redirect(302, '/auth/login?error=1');
        return;
      }

      throw new UnauthorizedException('Incorrect username or password');
    }

    await promisify(req.session.regenerate.bind(req.session))();
    req.session.user = { username: req.body.username };
    await promisify(req.session.save.bind(req.session))();

    if (req.accepts('html')) {
      const redirectTo = this.getRedirectTo(req, '/docs');
      res.redirect(302, redirectTo);
    } else {
      res.json({});
    }
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    if (req.session.user) {
      (req.session as SessionEnd).user = null;
      await promisify(req.session.save.bind(req.session))();
      await promisify(req.session.regenerate.bind(req.session))();
      await promisify(req.session.destroy.bind(req.session))();
    }

    if (req.accepts('html')) {
      const redirectTo = this.getRedirectTo(req, '/');
      res.clearCookie('connect.sid').redirect(302, redirectTo);
    } else {
      res.clearCookie('connect.sid').json({});
    }
  }

  @Post('logout')
  async doLogout(@Req() req: Request, @Res() res: Response) {
    if (req.session.user) {
      (req.session as SessionEnd).user = null;
      await promisify(req.session.save.bind(req.session))();
      await promisify(req.session.regenerate.bind(req.session))();
      await promisify(req.session.destroy.bind(req.session))();
    }

    res.clearCookie('connect.sid').json({});
  }

  @Get('user')
  async user(@Req() req: Request): Promise<session.SessionData['user']> {
    return req.session.user as session.SessionData['user'];
  }

  private getRedirectTo(req: Request, fallback: string) {
    const redirectTo = req.query['redirectTo'];
    return typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : fallback;
  }
}
