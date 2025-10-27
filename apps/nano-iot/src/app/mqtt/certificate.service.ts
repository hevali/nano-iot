import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisified as pem } from 'pem';
import { pki } from 'node-forge';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { TypedConfigService } from '../lib/config';
import { TlsOptions } from 'tls';

const CERT_DIR = path.join(__dirname, '..', 'certs');

export interface Credentials {
  ca: string;
  certificate: string;
  key: string;
}

@Injectable()
export class CertificateService implements OnModuleInit {
  private logger = new Logger(CertificateService.name);

  private serverCert!: string;
  private serverKey!: string;

  private mqttCert!: string;
  private mqttKey!: string;

  constructor(@Inject(ConfigService) private configService: TypedConfigService) {}

  async onModuleInit() {
    this.serverCert =
      this.configService.get<string>('APP_MQTT_SERVER_CERT', '') ||
      (await fs.readFile(
        this.configService.getOrThrow<string>('APP_MQTT_SERVER_CERT_PATH'),
        'utf-8'
      ));
    this.serverKey =
      this.configService.get<string>('APP_MQTT_SERVER_KEY', '') ||
      (await fs.readFile(
        this.configService.getOrThrow<string>('APP_MQTT_SERVER_KEY_PATH'),
        'utf-8'
      ));

    this.mqttCert =
      this.configService.get<string>('APP_MQTT_TLS_CERT', '') ||
      (await fs.readFile(this.configService.getOrThrow<string>('APP_MQTT_TLS_CERT_PATH'), 'utf-8'));
    this.mqttKey =
      this.configService.get<string>('APP_MQTT_TLS_KEY', '') ||
      (await fs.readFile(this.configService.getOrThrow<string>('APP_MQTT_TLS_KEY_PATH'), 'utf-8'));

    const x509 = pki.certificateFromPem(this.mqttCert);
    const keyUsage = x509.extensions.find((e) => e.name === 'keyUsage');
    if (keyUsage['keyCertSign'] !== true) {
      throw new Error('Key usage does not include keyCertSign');
    }
  }

  getMqttTlsConfig(): TlsOptions {
    return {
      ca: [this.mqttCert],
      cert: this.serverCert,
      key: this.serverKey,
    };
  }

  async createCertificate(clientId: string): Promise<Credentials> {
    const { key } = await pem.createPrivateKey(2048);
    const { csr } = await pem.createCSR({
      clientKey: key,
      commonName: clientId,
    });
    const { certificate } = await pem.createCertificate({
      csr,
      serviceKey: this.mqttKey,
      serviceCertificate: this.mqttCert,
      config: `[v3_req]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
basicConstraints = critical, CA:false
keyUsage = nonRepudiation, digitalSignature, keyEncipherment`,
    });

    this.logger.log(`Created certificate for client ${clientId}`);

    const ok = await pem.verifySigningChain(certificate, [this.mqttCert]);
    if (!ok) {
      throw Error('Could not verify certificate chain');
    }

    this.logger.log(`Verified certificate chain`);

    const clientsPath = path.join(CERT_DIR, 'clients');
    await fs.outputFile(path.join(clientsPath, `${clientId}.key`), key);
    await fs.outputFile(path.join(clientsPath, `${clientId}.crt`), certificate);

    return { ca: this.mqttCert, certificate, key };
  }
}
