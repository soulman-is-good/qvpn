import { Socket, createConnection } from 'net';
import log4js from 'log4js';
import { MaintainceFrameType, FrameFactory, ClientFrameType } from '../frames';
import { IService } from '../interfaces/IService';
import { QTCPConnection, QTCPConnectionOptions } from './QTCPConnection';

const log = log4js.getLogger('QVPNClient');

export interface QVPNClientOptions {
  pingInterval: number;
  serverPort: number;
  serverHost: string;
  authorizationToken: string;
  connections: {
    [name: string]: Pick<
      QTCPConnectionOptions,
      'externalHost' | 'externalPort'
    >;
  };
}

export class QVPNClient {
  private _socket: Socket;
  private _options: QVPNClientOptions;
  private _pingInt: NodeJS.Timeout;

  constructor(
    options?: Partial<QVPNClientOptions> &
      Pick<QVPNClientOptions, 'connections' | 'authorizationToken'>,
  ) {
    this._options = {
      pingInterval: 5000,
      serverPort: 31313,
      serverHost: 'localhost',
      ...options,
    };
  }

  async start() {
    const frames = new FrameFactory<ClientFrameType>();

    this._socket = createConnection(this._options.serverPort);

    return new Promise((resolve, reject) => {
      this._socket.on('connect', () => {
        resolve();
        this._onConnect();
      });
      this._socket.on('error', reject);
      this._socket.on('close', this._onClose.bind(this));
      this._socket.on('data', data => frames.addChunk(data));
      frames.on('PORTS', async frame => {
        log.info('Services frame received');
        const services = JSON.parse(frame.payload.toString());
        log.debug(services);

        // TODO: Initialize services
        await this._initializeServices(services);

        // Set ping messages
        this._pingServer();
      });
    });
  }

  private _onConnect() {
    log.info('Connected to server');
    // Send authorization request
    FrameFactory.toBufferStack<MaintainceFrameType>(
      'AUTH',
      Buffer.from(this._options.authorizationToken),
    ).forEach(buf => this._socket.write(buf));
  }

  private _onClose() {
    log.info('Conneciton closed to server');
    clearTimeout(this._pingInt);
    this._socket = null;
    // TODO: reconnect?
  }

  private _pingServer() {
    this._pingInt = setTimeout(() => {
      this._pingInt = null;
      FrameFactory.toBufferStack<MaintainceFrameType>('PING').forEach(buf => {
        this._socket.write(buf, err => {
          if (err) {
            log.warn('Socket PING error', err);
          }
          if (!this._pingInt) {
            this._pingServer();
          }
        });
      });
    }, this._options.pingInterval);
  }

  private _initializeServices(services: IService[]) {
    return Promise.all(
      services.map(svc => {
        const ops = this._options.connections[svc.name];
        const s = new QTCPConnection({
          name: svc.name,
          // TODO: What to do??
          internalHost: 'localhost',
          internalPort: svc.port,
          ...ops,
        });

        return s.start();
      }),
    );
  }
}
