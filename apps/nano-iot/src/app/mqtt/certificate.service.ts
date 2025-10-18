import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisified as pem } from 'pem';
import * as fs from 'fs-extra';
import * as path from 'path';

const CERT_DIR = path.join(__dirname, '..', 'certs');

@Injectable()
export class CertificateService {
  private logger = new Logger(CertificateService.name);
  private rootKey = this.configService.get<string>('APP_MQTT_ROOT_KEY', '');
  private rootCert = this.configService.get<string>('APP_MQTT_ROOT_CERT', '');

  constructor(private readonly configService: ConfigService) {}

  async createCertificate(clientId: string) {
    const { key } = await pem.createPrivateKey(2048);
    const { csr } = await pem.createCSR({ clientKey: key, commonName: clientId });
    const { certificate } = await pem.createCertificate({
      csr,
      serviceKey: this.rootKey,
      serviceCertificate: this.rootCert,
    });

    this.logger.log(`Created certificate for client ${clientId}`);

    const ok = await pem.verifySigningChain(certificate, [this.rootCert]);
    if (!ok) {
      throw Error('Could not verify certificate chain');
    }

    this.logger.log(`Verified certificate chain`);

    const clientsPath = path.join(CERT_DIR, 'clients');
    await fs.outputFile(path.join(clientsPath, `${clientId}.key`), key);
    await fs.outputFile(path.join(clientsPath, `${clientId}.crt`), certificate);

    return { certificate, key };
  }
}
