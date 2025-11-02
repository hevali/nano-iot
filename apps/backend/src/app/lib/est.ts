import { applyDecorators, Controller, Injectable, OnApplicationShutdown } from '@nestjs/common';
import * as http from 'http';

export const EstHostController = (path?: string): ClassDecorator => {
  return applyDecorators(Controller({ path, host: 'est' }));
};

@Injectable()
export class ShutdownObserver implements OnApplicationShutdown {
  private httpServers: http.Server[] = [];

  public addHttpServer(server: http.Server): void {
    this.httpServers.push(server);
  }

  public async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      this.httpServers.map(
        (server) =>
          new Promise((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
              } else {
                resolve(null);
              }
            });
          })
      )
    );
  }
}
