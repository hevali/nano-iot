import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Aedes, { createBroker } from 'aedes';
import { createServer, Server } from 'aedes-server-factory';
import * as https from 'https';
import { firstValueFrom, skip, throttleTime } from 'rxjs';
import stoppable from 'stoppable';

import type { TypedConfigService } from '../lib/config';
import { CertificateService } from './certificate.service';
import { EchoController } from './echo.controller';
import { MqttServerService, MqttService } from './mqtt.service';
import { RpcDiscoveryService, RpcService } from './rpc.service';

const EXPORTS = [RpcService, CertificateService, MqttService];

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    ...EXPORTS,
    MqttServerService,
    RpcDiscoveryService,
    {
      provide: Aedes,
      useFactory: () => {
        return createBroker({
          id: 'nano-iot',
          concurrency: 100,
          queueLimit: 100,
          maxClientsIdLength: 32,
          connectTimeout: 30000,
          heartbeatInterval: 60000,
        });
      },
    },
  ],
  exports: [...EXPORTS],
  controllers: [EchoController],
})
export class MqttModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private logger = new Logger(MqttModule.name);
  private server!: Server & stoppable.WithStop;

  constructor(
    private broker: Aedes,
    private certificateService: CertificateService,
    @Inject(ConfigService) private configService: TypedConfigService,
  ) {}

  async onApplicationBootstrap() {
    const mqttPort = this.configService.getOrThrow<number>('APP_MQTT_PORT', 1884);

    const crl = await firstValueFrom(this.certificateService.crl$);
    this.server = this.createServer(crl);

    await new Promise<void>((res, rej) => {
      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          this.logger.error('MQTT broker port already in use');
          rej();
        }
      });

      this.server.listen(mqttPort, () => {
        this.logger.log(`MQTT broker started and listening on port ${mqttPort}`);
        res();
      });
    });

    this.certificateService.crl$.pipe(skip(1), throttleTime(60)).subscribe((crl) => {
      this.logger.log('Rotating server after CRL update');

      this.server.on('close', () => {
        this.server.removeAllListeners();
        this.server = this.createServer(crl);

        this.server.listen(mqttPort, () => {
          this.logger.log(`Server rotation completed`);
        });
      });

      this.server.stop();
    });
  }

  async onApplicationShutdown() {
    await new Promise<void>((res, rej) =>
      this.broker.close(() => this.server.close((err) => (err ? rej(err) : res()))),
    );
  }

  private createServer(crl: string[]) {
    const trustProxy = this.configService.getOrThrow<boolean>('APP_TRUST_PROXY');
    const tls = this.certificateService.getMqttTlsConfig();

    const server = createServer(this.broker, {
      tls: {
        ...tls,
        crl,
        requestCert: true,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
      trustProxy,
    });

    return stoppable(server as https.Server, 5000);
  }
}
