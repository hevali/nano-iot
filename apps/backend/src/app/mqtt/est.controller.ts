import { Get, Post, Header, Res, Req } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { EstHostController } from '../lib';
import type { Request, Response } from 'express';
import { ApiConsumes, ApiProduces } from '@nestjs/swagger';

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
    await this.assertAuth(req);
    const csr = (req.read() as Buffer).toString('utf-8');
    const cert = await this.certificateService.signEstCsr(
      `-----BEGIN NEW CERTIFICATE REQUEST-----\n${csr}\n-----END NEW CERTIFICATE REQUEST-----`
    );
    const [, , content] = cert.split(/\n?-----\n?/);
    res.send(content);
  }

  @ApiConsumes('application/pkcs10')
  @Header('Content-Type', 'application/pkcs7-mime')
  @Post('simplereenroll')
  async simplereenroll(@Req() req: Request, @Res() res: Response) {
    await this.assertAuth(req);
    const csr = (req.read() as Buffer).toString('utf-8');
    const cert = await this.certificateService.signEstCsr(
      `-----BEGIN NEW CERTIFICATE REQUEST-----\n${csr}\n-----END NEW CERTIFICATE REQUEST-----`
    );
    const [, , content] = cert.split(/\n?-----\n?/);
    res.send(content);
  }

  private async assertAuth(req: Request) {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const auth = Buffer.from(b64auth, 'base64').toString();
    const splitIndex = auth.indexOf(':');
    const login = auth.substring(0, splitIndex);
    const password = auth.substring(splitIndex + 1);

    return true;

    // TODO: validate with device credentials.
  }
}
