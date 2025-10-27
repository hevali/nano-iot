import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import session from 'express-session';
import { promisify } from 'util';
import type { TypedConfigService } from '../lib/config';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

interface SessionEnd extends session.Session {
  user: unknown | null;
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    if (req.session.user) {
      // Already logged in
      res.redirect(302, '/docs');
      return;
    }

    const error = req.query.error
      ? `<div style="color: 'red'">Incorrect user and password</div>`
      : '';
    const html =
      error +
      `<form action="/auth/login" method="post">
Username: <input name="user"><br>
Password: <input name="pass" type="password"><br>
<input type="submit" text="Login"></form>`;

    res.clearCookie('connect.sid').send(html);
  }

  @Post('login')
  async doLogin(@Req() req: Request, @Res() res: Response) {
    const [user, hash] = this.configService.getOrThrow<string>('APP_INITIAL_USER').split(':');
    const match = await bcrypt.compare(req.body.pass, hash);
    if (!match || user !== req.body.user) {
      res.redirect(302, '/auth/login?error=1');
      return;
    }

    await promisify(req.session.regenerate.bind(req.session))();
    req.session.user = { username: req.body.user };
    await promisify(req.session.save.bind(req.session))();

    res.redirect(302, '/docs');
  }

  @Get('logout')
  async doLogout(@Req() req: Request, @Res() res: Response) {
    if (req.session.user) {
      (req.session as SessionEnd).user = null;
      await promisify(req.session.save.bind(req.session))();
      await promisify(req.session.regenerate.bind(req.session))();
      await promisify(req.session.destroy.bind(req.session))();
    }

    res.clearCookie('connect.sid').redirect(302, '/auth/login');
  }
}
