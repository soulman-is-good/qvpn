import { Server, Socket, createServer } from 'net';
import { TlsOptions } from 'tls';
import log4js from 'log4js';
import { FrameFactory, MaintainceFrameType, ClientFrameType } from '../frames';
import { findClientById } from '../utils/clientUtils';
import { QClient } from './QClient';
import { IDataProvider } from '../interfaces/IDataProvider';

const log = log4js.getLogger('QVPNServer');

export interface QVPNServerOptions {
  timeout: number;
  host: string;
  port: number;
  dataProvider: IDataProvider;
  serviceTLSOptions?: TlsOptions;
}

export class QVPNServer {
  private _server: Server;
  private _error?: Error;
  private _clients: Map<Socket, QClient>;
  private _options: QVPNServerOptions;

  constructor(options?: Partial<QVPNServerOptions>) {
    this._clients = new Map();
    this._options = {
      timeout: 10000,
      host: '0.0.0.0',
      port: 31313,
      dataProvider: () => [],
      ...options,
    };
  }

  public start(): Promise<void> {
    this._server = createServer();
    this._server.on('listening', () => {
      log.info(`Listening on ${this._options.host}:${this._options.port}...`);
    });
    this._server.on('connection', this._onConnection.bind(this));
    this._server.on('error', this._onError.bind(this));
    this._server.on('close', this._onClose.bind(this));

    return new Promise(resolve =>
      this._server.listen(this._options.port, this._options.host, resolve),
    );
  }

  public stop() {
    this._onClose();
    return new Promise((resolve, reject) =>
      this._server.close(err => (err ? reject(err) : resolve())),
    );
  }

  public getLastError(): Error {
    return this._error;
  }

  get host(): string {
    return this._options.host;
  }

  get port(): number {
    return this._options.port;
  }

  private _onConnection(socket: Socket) {
    const frames = new FrameFactory<MaintainceFrameType>();

    log.info(`Client connected ${socket.remoteAddress}`);
    socket.setTimeout(this._options.timeout);
    socket.on('close', (hadError: boolean) => {
      if (hadError) {
        frames.dropLast();
      }
      this._clients.delete(socket);
    });
    // socket.on('connect', () => {});
    socket.on('data', (data: Buffer) => {
      frames.addChunk(data);
    });
    // socket.on('drain', () => {});
    // socket.on('end', () => {});
    // socket.on('error', (error: Error) => {});
    // socket.on('timeout', () => {});

    // 1. Client Authorizes on clients data
    // 2. Server initializes services on dynamic ports
    // 3. Server sends to client services and ports to connect to
    // --
    // 4. When request comes to a server server passes data to client
    // 5. Client processes the request and returns back to server
    // 6. Server proxies reply from client to requester

    frames.on('PING', () => {
      FrameFactory.toBufferStack<ClientFrameType>('PONG').forEach(buf =>
        socket.write(buf),
      );
    });

    frames.on('AUTH', async frame => {
      const token = frame.payload.toString();
      const data = await this._options.dataProvider();
      const clientData = findClientById(data, token);

      if (!clientData) {
        log.warn(
          `Incorrect authentication from ${socket.remoteAddress} with ${token}`,
        );

        return;
      }
      const client = new QClient(
        clientData.client_id,
        clientData.client_title,
        clientData.client_services,
        this._options.serviceTLSOptions,
      );

      this._clients.set(socket, client);
      await client.startServices();
      const portsPackage = client.prepareServicePackage();

      FrameFactory.toBufferStack<ClientFrameType>(
        'PORTS',
        portsPackage,
      ).forEach(message => socket.write(message));
    });
  }

  private _onError(error: Error) {
    this._error = error;
  }

  private _onClose() {
    this._clients.forEach((_cli, socket) => {
      _cli.closeServices();
      socket.end();
    });
    this._clients = new Map();
    // TODO: Not able to start server again??
  }
}
