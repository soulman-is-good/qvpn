import { isObject } from 'util';
import { ClientService } from '../utils/clientUtils';
import { QService } from './QService';

export class QClient {
  private _svcs: Map<string, QService>;

  constructor(
    public id: string,
    public title: string,
    public services: ClientService[],
  ) {
    this._svcs = new Map();
    services.forEach(svc => {
      this._svcs.set(svc.service_name, new QService(svc.service_name));
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
          .map(svcD => {
            const svc = this._svcs.get(svcD.service_name);
            const name = svcD.service_name;

            if (!svc) return null;

            return {
              name,
              port: svc.port,
            };
          })
          .filter(isObject),
      ),
    );
  }
}
