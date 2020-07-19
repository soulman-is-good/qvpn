import { Server, createServer, AddressInfo } from 'net';

export class QService {
  private _server: Server;
  public name: string;

  constructor(name: string) {
    this.name = name;
  }

  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this._server) {
        resolve((this._server.address() as AddressInfo).port);

        return;
      }
      this._server = createServer();
      this._server.on('listening', () => {
        resolve((this._server.address() as AddressInfo).port);
      });
      this._server.on('error', reject);
      this._server.listen();
    });
  }

  close() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  get port() {
    return (this._server.address() as AddressInfo)?.port;
  }
}
