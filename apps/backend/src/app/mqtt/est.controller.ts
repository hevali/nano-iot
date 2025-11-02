import { Get, Post, Header, Res, Req, UnauthorizedException, HttpException } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { EstHostController } from '../lib';
import type { Request, Response } from 'express';
import { ApiConsumes, ApiProduces } from '@nestjs/swagger';
import * as crypto from 'crypto';

// https://datatracker.ietf.org/doc/html/rfc7030
@EstHostController('.well-known/est')
export class EstController {
  constructor(private certificateService: CertificateService) {}

  @ApiProduces('application/pkcs7-mime')
  @Header('Content-Type', 'application/pkcs7-mime')
  @Header('Content-Transfer-Encoding', 'base64')
  @Get('cacerts')
  async ca(@Res() res: Response) {
    const { ca } = this.certificateService.getMqttTlsConfig();
    const [, , content] = ca.split(/\n?-----\n?/);
    res.send(content);
  }

  @ApiConsumes('application/pkcs10')
  @Header('Content-Type', 'application/pkcs7-mime;smime-type=certs-only')
  @Post('simpleenroll')
  async simpleenroll(@Req() req: Request, @Res() res: Response) {
    try {
      await this.assertAuth(req);
      // Initial certificate claim. Check for an existing, valid certificate before issuing a new one.
      // Check Subject and keyUsage extension to match the requested device.
      const csr = (req.read() as Buffer).toString('utf-8');
      const cert = await this.certificateService.signEstCsr(
        `-----BEGIN NEW CERTIFICATE REQUEST-----\n${csr}\n-----END NEW CERTIFICATE REQUEST-----`
      );
      const [, , content] = cert.split(/\n?-----\n?/);
      res.send(content);
    } catch (e) {
      if (e instanceof HttpException) {
        res.status(e.getStatus()).send(e.message);
      } else {
        res.status(500).send('Unknown error');
      }
    }
  }

  @ApiConsumes('application/pkcs10')
  @Header('Content-Type', 'application/pkcs7-mime;smime-type=certs-only')
  @Post('simplereenroll')
  async simplereenroll(@Req() req: Request, @Res() res: Response) {
    try {
      await this.assertAuth(req);
      // Subject and SubjectAltName must be the same as current certificate.
      // Ingnore ChangeSubjectName attribute.
      // If public key changes the certificate is only rekeyed (exp date stays the same).
      const csr = (req.read() as Buffer).toString('utf-8');
      const cert = await this.certificateService.signEstCsr(
        `-----BEGIN NEW CERTIFICATE REQUEST-----\n${csr}\n-----END NEW CERTIFICATE REQUEST-----`
      );
      const [, , content] = cert.split(/\n?-----\n?/);
      res.send(content);
    } catch (e) {
      if (e instanceof HttpException) {
        res.status(e.getStatus()).send(e.message);
      } else {
        res.status(500).send('Unknown error');
      }
    }
  }

  private async assertAuth(req: Request) {
    if (!req.headers.authorization) {
      throw new UnauthorizedException('Basic authorization required');
    }

    const authHeader = req.headers.authorization.split(' ')[1] || '';
    const auth = Buffer.from(authHeader, 'base64').toString();
    const splitIndex = auth.indexOf(':');
    const user = auth.substring(0, splitIndex);
    const password = auth.substring(splitIndex + 1);

    const device = {}; //...

    const result = crypto
      .createHmac('sha1', 'key')
      .update(`${user}:${device.createdAt.getTime()}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(result));
  }
}
