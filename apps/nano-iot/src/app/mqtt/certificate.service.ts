import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promisified as pem } from 'pem';
import * as fs from 'fs-extra';
import * as path from 'path';

const CERT_CONFIG = `
[ req ]
req_extensions     = v3_req
default_bits       = 2048 # default key size in bits.
distinguished_name = req_distinguished_name # the name of the tag in this file, which specifies certificates fields description during certificate creation and eventually set some default values.
string_mask        = utf8only # permitted string type mask.
default_md         = sha256 # hash function.
x509_extensions    = v3_ca # the name of the tag in this file, which specifies certificates extensions, which will be added to the created certificate by default.

[ req_distinguished_name ]
commonName     = nano-iot
commonName_max = 64

[ v3_req ]
subjectKeyIdentifier   = hash # subject key value will be calculated using hash funtion. It's the recommended setting by PKIX.
authorityKeyIdentifier = keyid:always,issuer # The subject key identifier will be copied from the parent certificate. It's the recommended setting by PKIX.
basicConstraints       = critical, CA:true, pathlen:10 # "critical" specifies that the extension is important and must be read by the platform. CA says if it is the CA certificate so it can be used to sign different certificates. "pathlen" specifies the maximum path length between this certificate and the device certificate in the chain of certificates during authentication. Path length is set here only to show how it is done. If you do not want to specify max path length, you can keep only the "basicConstraints = critical, CA:true" part here.
keyUsage               = digitalSignature, cRLSign, keyCertSign # specifies permitted key usages.`;

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
