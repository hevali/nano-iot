import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pki } from 'node-forge';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import type { TypedConfigService } from '../lib/config';
import { TlsOptions } from 'tls';
import { promisify } from 'util';
import { BehaviorSubject } from 'rxjs';
import { randomUUID } from 'crypto';
import AsyncLock from 'async-lock';

const execFile = promisify(cp.execFile);
const asyncLock = new AsyncLock();

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

  private caPath = path.join(this.configService.getOrThrow<string>('APP_DATA_DIR'), 'ca');
  private mqttCertPath!: string;
  private mqttKeyPath!: string;

  private crlPath = path.join(this.caPath, `mqtt.crl`);
  private databasePath = path.join(this.caPath, 'database.txt');
  private configPath = path.join(this.caPath, 'ca.conf');

  private crl = new BehaviorSubject<string[]>([]);
  crl$ = this.crl.asObservable();

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

    this.mqttCertPath = this.configService.get<string>('APP_MQTT_TLS_CERT_PATH', '');
    if (!this.mqttCertPath) {
      this.logger.log('Copying MQTT certificate to filesystem for use with openssl');
      const cert = this.configService.getOrThrow<string>('APP_MQTT_TLS_CERT');
      this.mqttCertPath = path.join(this.caPath, 'mqtt.crt');
      await fs.outputFile(this.mqttCertPath, cert, 'utf-8');
    }
    this.mqttCert = await fs.readFile(this.mqttCertPath, 'utf-8');

    this.mqttKeyPath = this.configService.get<string>('APP_MQTT_TLS_KEY_PATH', '');
    if (!this.mqttKeyPath) {
      this.logger.log('Copying MQTT key to filesystem for use with openssl');
      const key = this.configService.getOrThrow<string>('APP_MQTT_TLS_KEY');
      this.mqttKeyPath = path.join(this.caPath, 'mqtt.key');
      await fs.outputFile(this.mqttKeyPath, key, 'utf-8');
    }

    const x509 = pki.certificateFromPem(this.mqttCert);
    const keyUsage = x509.extensions.find((e) => e.name === 'keyUsage');
    if (keyUsage['keyCertSign'] !== true) {
      throw new Error('Key usage does not include keyCertSign');
    }

    const crl = await fs.readFile(this.crlPath, 'utf-8').catch(() => '');
    if (crl) {
      this.crl.next([crl]);
    }

    const config = await fs.readFile(this.configPath, 'utf-8').catch(() => '');
    if (config.length) {
      return;
    }

    this.logger.warn('Setting up new CA, this is a one time task');

    await fs.outputFile(this.configPath, this.getCaConfig(), 'utf-8');
    await fs.ensureFile(this.databasePath);

    await fs.ensureDir(path.join(this.caPath, 'certs'));
    await fs.ensureDir(path.join(this.caPath, 'crl'));

    const databaseAttrPath = path.join(this.caPath, 'database.txt.attr');
    const databaseAttr = await fs.readFile(databaseAttrPath, 'utf-8').catch(() => '');
    if (!databaseAttr.length) {
      await fs.outputFile(databaseAttrPath, 'unique_subject = no', 'utf-8');
    }

    const serialPath = path.join(this.caPath, 'serial');
    const serial = await fs.readFile(serialPath, 'utf-8').catch(() => '');
    if (!serial.length) {
      await fs.outputFile(serialPath, '1000', 'utf-8');
    }

    const crlNumberPath = path.join(this.caPath, 'crl', 'crlnumber');
    const crlNumber = await fs.readFile(crlNumberPath, 'utf-8').catch(() => '');
    if (!crlNumber.length) {
      await fs.outputFile(crlNumber, '1000', 'utf-8');
    }

    this.logger.log('CA setup completed');
  }

  getMqttTlsConfig(): TlsOptions {
    return {
      ca: [this.mqttCert],
      cert: this.serverCert,
      key: this.serverKey,
    };
  }

  async createCertificate(clientId: string, validDays = 365): Promise<Credentials> {
    const uuid = randomUUID();
    const tmpKeyPath = path.join(os.tmpdir(), `${uuid}.key`);
    const tmpCsrPath = path.join(os.tmpdir(), `${uuid}.csr`);

    this.logger.log(`Requested certificate for client ${clientId}`);

    try {
      await execFile(`openssl`, ['genrsa', '-out', tmpKeyPath, '2048']);
      await execFile('openssl', [
        'req',
        '-config',
        this.configPath,
        '-subj',
        `/CN=${clientId}`,
        '-new',
        '-sha256',
        '-key',
        tmpKeyPath,
        '-out',
        tmpCsrPath,
      ]);

      const serial = await asyncLock.acquire('sign', async () => {
        await execFile('openssl', [
          'ca',
          '-config',
          this.configPath,
          '-extensions',
          'v3_req',
          '-days',
          validDays.toString(),
          '-notext',
          '-md',
          'sha256',
          '-batch',
          '-in',
          tmpCsrPath,
        ]);

        const { stdout } = await execFile('tail', ['-n', '1', this.databasePath]);

        return stdout.split('\t')[3];
      });

      const deviceCertPath = path.join(this.caPath, 'certs', `${serial}.pem`);

      this.logger.log(`Created certificate for client ${clientId} (serial: ${serial})`);
      await execFile(
        'openssl',
        ['verify', '-partial_chain', '-CAfile', this.mqttCertPath, deviceCertPath],
        {}
      );
      this.logger.log(`Verified certificate chain`);

      const key = await fs.readFile(tmpKeyPath, 'utf-8');
      const certificate = await fs.readFile(deviceCertPath, 'utf-8');

      return { ca: this.mqttCert, certificate, key };
    } catch (e) {
      this.logger.error(`Could not create device ${clientId} certificate`, e);
      throw new InternalServerErrorException('Could not create device certificate');
    } finally {
      await fs.remove(tmpKeyPath);
      await fs.remove(tmpCsrPath);
    }
  }

  async revokeCertificate(clientId: string): Promise<void> {
    const database = await fs.readFile(this.databasePath, 'utf-8');
    const data = database.split('\n');
    const rows = data.filter((r) => {
      const [status, , , , , cn] = r.split('\t');
      return cn === `/CN=${clientId}` && status === 'V';
    });
    if (!rows.length) {
      this.logger.warn(`No certificate found to revoke for device ${clientId}`);
      return;
    }

    const crl = await asyncLock.acquire('revoke', async () => {
      for (const row of rows) {
        const [, , , serial] = row.split('\t');

        await execFile(
          'openssl',
          [
            'ca',
            '-config',
            this.configPath,
            '-revoke',
            path.join(this.caPath, 'certs', `${serial}.pem`),
          ],
          {}
        );

        this.logger.log(`Revoked certificate for client ${clientId} (serial: ${serial})`);

        await execFile(
          'openssl',
          ['ca', '-config', this.configPath, '-batch', '-gencrl', '-out', this.crlPath],
          {}
        );
      }

      this.logger.log(`Updated CRL`);
      return fs.readFile(this.crlPath, 'utf-8');
    });

    this.crl.next([crl]);
  }

  private getCaConfig() {
    return `[ ca ]
default_ca = CA_default

[ CA_default ]
# Directory and file locations.
dir               = ${this.caPath}
certs             = $dir # directory where the CA certificate will be stored.
crl_dir           = $dir/crl # directory where the certificate revocation list will be stored.
new_certs_dir     = $dir/certs # directory where certificates signed by CA certificate will be stored.
database          = $dir/database.txt # database file, where the history of the certificates signing operations will be stored.
serial            = $dir/serial # directory to the file, which stores next value that will be assigned to signed certificate.

# The CA key and CA certificate for signing other certificates.
private_key       = ${this.mqttKeyPath} # CA private key which will be used for signing certificates.
certificate       = ${this.mqttCertPath} # CA certificate, which will be the issuer of signed certificate.

default_md        = sha256 # hash function
default_days      = 375 # default number of days for which the certificate will be valid since the date of its generation.
preserve          = no # if set to 'no' then it will determine the same order of the distinguished name in every signed certificate.
policy            = signing_policy # the name of the tag in this file that specifies the fields of the certificate. The fields must be filled in or even match the CA certificate values to be signed.

# For certificate revocation lists.
crl               = $crl_dir/caCrl.pem # CA certificate revocation list
crlnumber         = $crl_dir/crlnumber # serial, but for the certificate revocation list
crl_extensions    = crl_ext # the name of the tag in this file, which specifies certificates revocation list extensions, which will be added to the certificate revocation by default.
default_crl_days  = 1 # default number of days for which the certificate revocation list will be valid since the date of its generation. After that date it should be updated to see if there are new entries on the list.

[ req ]
default_bits        = 2048 # default key size in bits.
distinguished_name  = req_distinguished_name # the name of the tag in this file, which specifies certificates fields description during certificate creation and eventually set some default values.
string_mask         = utf8only # permitted string type mask.
default_md          = sha256 # hash function.
x509_extensions     = v3_ca # the name of the tag in this file, which specifies certificates extensions, which will be added to the created certificate by default.

# descriptions and default values of the created certificate fields.
[ req_distinguished_name ]
countryName                     = Country Name (2 letter code)
stateOrProvinceName             = State or Province Name
localityName                    = Locality Name
organizationName                = Organization Name
organizationalUnitName          = Organizational Unit Name
commonName                      = Common Name
emailAddress                    = Email Address

# default extensions for the CA certificate.
[ v3_ca ]
subjectKeyIdentifier = hash # subject key value will be calculated using hash funtion. It's the recommended setting by PKIX.
authorityKeyIdentifier = keyid:always,issuer # The subject key identifier will be copied from the parent certificate. It's the recommended setting by PKIX.
basicConstraints = critical, CA:true, pathlen:2 # "critical" specifies that the extension is important and must be read by the platform. CA says if it is the CA certificate so it can be used to sign different certificates. "pathlen" specifies the maximum path length between this certificate and the device certificate in the chain of certificates during authentication. Path length is set here only to show how it is done. If you do not want to specify max path length, you can keep only the "basicConstraints = critical, CA:true" part here.
keyUsage = digitalSignature, cRLSign, keyCertSign # specifies permitted key usages.

# Default extensions for the device certificate. This tag is not used directly anywhere in this file, but will be used from the command line to create signed certificate with "-extensions v3_req" parameter.
[ v3_req ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
basicConstraints = critical, CA:false
keyUsage = nonRepudiation, digitalSignature, keyEncipherment

# default extensions for certificate revocation list
[ crl_ext ]
authorityKeyIdentifier = keyid:always

# Policy of certificates signing. It specifies which certificate fields must be filled in during certificate creation. There are three possible values here:
# "optional" - field value can be empty
# "supplied" - field value must be filled in
# "match" - signed certificate field value must match the CA certificate value to be created
[ signing_policy ]
countryName             = optional
stateOrProvinceName     = optional
organizationName        = optional
organizationalUnitName  = optional
commonName              = supplied # every certificate should have a unique common name, so this value should not be changed.
emailAddress            = optional
`;
  }
}
