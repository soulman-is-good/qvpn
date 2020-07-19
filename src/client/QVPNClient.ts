import { Socket, createConnection } from 'net';

export class QVPNClient {
  private _socket: Socket;

  start() {
    this._socket = createConnection(31313);
  }
}
