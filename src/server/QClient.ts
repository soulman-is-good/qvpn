import { isObject } from 'util';
import { ClientService } from '../interfaces/ClientData';
import { QService } from './QService';
import { IService } from '../interfaces/IService';

export class QClient {
  private _svcs: Map<string, QService>;

  constructor(
    public id: string,
    public title: string,
    public services: ClientService[],
  ) {
    this._svcs = new Map();
    services.forEach(svc => {
      this._svcs.set(svc.name, new QService(svc));
    });
  }

  startServices() {
    return Promise.all(Array.from(this._svcs.values()).map(svc => svc.start()));
  }

  closeServices() {
    this._svcs.forEach(svc => {
      svc.close();
    });
  }

  prepareServicePackage() {
    return Buffer.from(
      JSON.stringify(
        this.services
          .map(
            (svcD): IService => {
              const svc = this._svcs.get(svcD.name);

              if (!svc) return null;

              return {
                name: svcD.name,
                port: svcD.internalPort,
              };
            },
          )
          .filter(isObject),
      ),
    );
  }
}
