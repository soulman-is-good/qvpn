import { Server, Socket, createServer } from 'net';
import log4js from 'log4js';
import { FrameFactory, MaintainceFrame, ClientFrame } from '../frames';
import { findClientById } from '../utils/clientUtils';
import { MAGIC_BYTE } from '../consts/generic';
import { QClient } from './QClient';

const log = log4js.getLogger('QVPNServer');

export class QVPNServer {
  private _server: Server;
  private _host: string;
  private _port: number;
  private _error?: Error;
  private _clients: Map<Socket, QClient>;

  constructor(port = 31313, host = '0.0.0.0') {
    this._host = host;
    this._port = port;
    this._clients = new Map();
  }

  public start(): Promise<void> {
    this._server = createServer();
    this._server.on('listening', () => {
      log.info(`Listening on ${this._host}:${this._port}...`);
    });
    this._server.on('connection', this._onConnection.bind(this));
    this._server.on('error', this._onError.bind(this));
    this._server.on('close', this._onClose.bind(this));

    return new Promise(resolve =>
      this._server.listen(this._port, this._host, resolve),
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

  private prepareMessage(pack: Buffer) {
    const clientFrame = new ClientFrame(
      ClientFrame.TYPES.PORTS,
      pack,
    ).toBuffer();
    const magicBuf = Buffer.from([MAGIC_BYTE]);
    const frameType = Buffer.from([0x01]); // For future
    const length = Buffer.alloc(4);

    length.writeUInt32LE(clientFrame.length, 0);

    return Buffer.concat([magicBuf, frameType, length, clientFrame]);
  }

  get host(): string {
    return this._host;
  }

  get port(): number {
    return this._port;
  }

  private _onConnection(socket: Socket) {
    const frames = new FrameFactory((buf: Buffer) =>
      MaintainceFrame.fromData(buf),
    );

    log.info(`Client connected ${socket.remoteAddress}`);
    socket.setTimeout(1000);
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

    frames.on(MaintainceFrame.TYPES.AUTH, async (frame: MaintainceFrame) => {
      const token = frame.payload.toString();
      const clientData = findClientById(token);

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
      );

      this._clients.set(socket, client);
      await client.startServices();
      const portsPackage = client.prepareServicePackage();
      const message = this.prepareMessage(portsPackage);

      socket.write(message);
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
