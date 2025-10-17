import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Aedes from 'aedes';
import { createBroker } from 'aedes';
import { createServer } from 'aedes-server-factory';
import { MqttService } from './mqtt.service';
import { CertificateService } from './certificate.service';
import { EchoController } from './echo.controller';
import { RpcDiscoveryService, RpcService } from './rpc.service';
import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { promisified as pem } from 'pem';

@Module({
  imports: [DiscoveryModule],
  providers: [
    MqttService,
    CertificateService,
    RpcService,
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
  exports: [RpcService, CertificateService],
  controllers: [EchoController],
})
export class MqttModule implements OnApplicationBootstrap {
  private logger = new Logger(MqttModule.name);

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

    await new Promise<void>((res) => {
      createServer(this.broker, {
        tls: {
          key: rootKey,
          cert: rootCert,
          ca: [rootCert],
          requestCert: true,
        },
      }).listen(mqttPort, () => {
        this.logger.log(`MQTT broker started and listening on port ${mqttPort}`);
        res();
      });
    });
  }
}
