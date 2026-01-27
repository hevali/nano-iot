import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.session.user) {
      next();
      return;
    }

    // Unauthorized
    if (req.accepts('html')) {
      const path = req.originalUrl || req.url;
      const query = path && path !== '/' ? `?redirectTo=${encodeURIComponent(path)}` : '';
      res.redirect(302, `/auth/login${query}`);
    } else {
      res.status(401).json(new UnauthorizedException('Not logged in').getResponse());
    }
  }
}
