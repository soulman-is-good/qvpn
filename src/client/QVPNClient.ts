import { Socket, createConnection } from 'net';
import log4js from 'log4js';
import {
  MaintainceFrameType,
  MaintainceFrame,
  FrameFactory,
  ClientFrame,
} from '../frames';
import { MAGIC_BYTE } from '../consts/generic';

const log = log4js.getLogger('QVPNClient');

export interface QVPNClientOptions {
  pingInterval: number;
  serverPort: number;
  serverHost: string;
  authorizationToken: string;
}

export class QVPNClient {
  private _socket: Socket;
  private _options: QVPNClientOptions;
  private _pingInt: NodeJS.Timeout;

  constructor(options?: Partial<QVPNClientOptions>) {
    this._options = {
      pingInterval: 5000,
      serverPort: 31313,
      serverHost: 'localhost',
      authorizationToken: '',
      ...options,
    };
  }

  start() {
    const frames = new FrameFactory(buf => ClientFrame.fromData(buf));

    this._socket = createConnection(this._options.serverPort);
    this._socket.on('connect', this._onConnect.bind(this));
    this._socket.on('close', this._onClose.bind(this));
    this._socket.on('data', data => frames.addChunk(data));
    frames.on(ClientFrame.TYPES.PORTS, (frame: ClientFrame) => {
      log.info('Services frame received');
      const services = JSON.parse(frame.payload.toString());
      log.debug(services);

      // TODO: Initialize services

      // Set ping messages
      this._pingServer();
    });
  }

  private _onConnect() {
    log.info('Connected to server');
    // Send authorization request
    this._socket.write(
      this._prepareMessage(
        MaintainceFrame.TYPES.AUTH,
        Buffer.from(this._options.authorizationToken),
      ),
    );
  }

  private _onClose() {
    log.info('Conneciton closed to server');
    clearTimeout(this._pingInt);
    this._socket = null;
    // TODO: reconnect?
  }

  private _pingServer() {
    this._pingInt = setTimeout(() => {
      this._socket.write(
        this._prepareMessage(MaintainceFrame.TYPES.PING),
        err => {
          if (err) {
            log.warn('Socket PING error', err);
          }
          this._pingServer();
        },
      );
    }, this._options.pingInterval);
  }

  private _prepareMessage(
    type: MaintainceFrameType,
    pack: Buffer = Buffer.alloc(0),
  ) {
    const clientFrame = new MaintainceFrame(type, pack).toBuffer();
    const magicBuf = Buffer.from([MAGIC_BYTE]);
    const frameType = Buffer.from([0x01]); // For future
    const length = Buffer.alloc(4);

    length.writeUInt32LE(clientFrame.length, 0);

    return Buffer.concat([magicBuf, frameType, length, clientFrame]);
  }
}
