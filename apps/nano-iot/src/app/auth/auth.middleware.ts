import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.session.user) {
      next();
      return;
    }

    // Unauthorized
    if (req.accepts('html')) {
      res.redirect(302, '/auth/login');
    } else {
      res.status(401).json(new UnauthorizedException('Not logged in').getResponse());
    }
  }
}
