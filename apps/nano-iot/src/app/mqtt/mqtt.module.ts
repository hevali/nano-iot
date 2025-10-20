import {
  Global,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Aedes from 'aedes';
import { createBroker } from 'aedes';
import { createServer, Server } from 'aedes-server-factory';
import { MqttServerService, MqttService } from './mqtt.service';
import { CertificateService } from './certificate.service';
import { EchoController } from './echo.controller';
import { RpcDiscoveryService, RpcService } from './rpc.service';
import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { promisified as pem } from 'pem';

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
  private server!: Server;

  constructor(private broker: Aedes, private readonly configService: ConfigService) {}

  async onApplicationBootstrap() {
    const rootKey = this.configService.get<string>('APP_MQTT_ROOT_KEY', '');
    const rootCert = this.configService.get<string>('APP_MQTT_ROOT_CERT', '');
    const mqttPort = this.configService.get<number>('APP_MQTT_PORT', 1884);

    const keyPublicKey = await pem.getPublicKey(rootKey);
    const certPublicKey = await pem.getPublicKey(rootCert);

    if (certPublicKey.publicKey !== keyPublicKey.publicKey) {
      throw new Error('Private key and certificate do not match');
    }

    const cert = await pem.readCertificateInfo(rootCert);
    this.logger.debug(cert);

    this.server = createServer(this.broker, {
      tls: {
        key: rootKey,
        cert: rootCert,
        ca: [rootCert],
        requestCert: true,
      },
    });

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
  }

  async onApplicationShutdown() {
    this.broker.close();
    this.server.close();
  }
}
