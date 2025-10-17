import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisified as pem } from 'pem';
import * as fs from 'fs-extra';
import * as path from 'path';

const CERT_DIR = path.join(__dirname, '..', 'certs');

@Injectable()
export class CertificateService implements OnModuleInit {
  private logger = new Logger(CertificateService.name);
  private rootKey = '';
  private rootCert = '';

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.rootKey = this.configService.get<string>('APP_MQTT_ROOT_KEY', '');
    this.rootCert = this.configService.get<string>('APP_MQTT_ROOT_CERT', '');

    const keyPublicKey = await pem.getPublicKey(this.rootKey);
    const certPublicKey = await pem.getPublicKey(this.rootCert);

    if (certPublicKey.publicKey !== keyPublicKey.publicKey) {
      throw new Error('Private key and certificate do not match');
    }

    const cert = await pem.readCertificateInfo(this.rootCert);
    this.logger.debug(cert);
  }

  async createCertificate(clientId: string) {
    const { key } = await pem.createPrivateKey(2048);
    const { csr } = await pem.createCSR({ clientKey: key, commonName: clientId });

    const { certificate } = await pem.createCertificate({
      csr,
      serviceKey: this.rootKey,
      serviceCertificate: this.rootCert,
    });

    this.logger.log(`Created certificate for client ${clientId}`);
    this.logger.debug(certificate);

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
