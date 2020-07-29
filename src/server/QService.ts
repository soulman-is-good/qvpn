import * as net from 'net';
import * as tls from 'tls';
import * as fs from 'fs';
import log4js from 'log4js';
import { FrameFactory, ServiceFrameType } from '../frames';

const log = log4js.getLogger('QService');

const options: tls.TlsOptions = {
  ca: fs.readFileSync('./rootCA.crt'),
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.crt'),
};

export interface QServiceOptions {
  name: string;
  host: string;
  internalPort?: number;
  externalPort?: number;
}

export class QService {
  private _server: net.Server;
  private _tunnel: tls.Server;
  private _options: QServiceOptions;

  constructor(params: Partial<QServiceOptions> & { name: string }) {
    this._options = {
      host: '0.0.0.0',
      ...params,
    };
  }

  start(): Promise<unknown> {
    return Promise.all([
      this._listenTunnel(),
      new Promise((resolve, reject) => {
        if (this._server) {
          resolve((this._server.address() as net.AddressInfo).port);

          return;
        }
        this._server = net.createServer();
        this._server.on('listening', () => {
          resolve((this._server.address() as net.AddressInfo).port);
        });
        this._server.on('error', reject);
        this._server.listen(this._options.externalPort, this._options.host);
      }),
    ]).then(() => this._setupPipe());
  }

  close() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  private async _setupPipe() {
    let clientSocket: tls.TLSSocket;
    const onData = <T extends string>(ff: FrameFactory<T>) => (buf: Buffer) =>
      ff.addChunk(buf);

    this._tunnelConnection().then(sock => {
      clientSocket = sock;
    });
    let connNum = 0;

    this._server.on('connection', async sock => {
      const sockId = connNum;
      const ff = new FrameFactory<ServiceFrameType>();
      const dataListener = onData(ff);

      log.debug(
        `Connection #${connNum} established on port ${sock.remotePort}...`,
      );
      connNum += 1;

      if (!clientSocket) {
        log.info('Client connection does not exists. Waiting...');
        clientSocket = await this._tunnelConnection();
      }
      sock.on('error', err => {
        log.error(err);
        clientSocket.off('data', dataListener);
      });
      clientSocket.on('data', dataListener);
      FrameFactory.toBufferStack<ServiceFrameType>(
        'NEW',
        Buffer.alloc(0),
        sockId,
      ).forEach(buf => {
        clientSocket.write(buf);
      });
      sock.on('data', buffer => {
        FrameFactory.toBufferStack<ServiceFrameType>(
          'DATA',
          buffer,
          sockId,
        ).forEach(buf => clientSocket.write(buf));
      });
      sock.on('close', () => {
        clientSocket.off('data', dataListener);
        FrameFactory.toBufferStack<ServiceFrameType>(
          'END',
          Buffer.alloc(0),
          sockId,
        ).forEach(buf => clientSocket.write(buf));
      });
      ff.on('DATA', (frame, seq) => {
        log.debug(`> DATA frame #${seq}`);
        if (seq === sockId) {
          sock.write(frame.payload);
        }
      });
      ff.on('END', (_f, seq) => {
        log.debug(`> END frame #${seq}`);
        if (seq === sockId) {
          sock.end();
        }
      });
    });
  }

  private _listenTunnel() {
    return new Promise((resolve, reject) => {
      if (this._tunnel) {
        resolve((this._tunnel.address() as net.AddressInfo).port);

        return;
      }
      this._tunnel = tls.createServer(options);
      this._tunnel.on('listening', () => {
        resolve((this._tunnel.address() as net.AddressInfo).port);
      });
      this._tunnel.on('error', err => {
        log.error(err);
        reject();
      });
      this._tunnel.on('close', () => {
        this._tunnel = null;
      });
      this._tunnel.listen(this._options.internalPort, this._options.host);
    });
  }

  private async _tunnelConnection(): Promise<tls.TLSSocket> {
    if (!this._tunnel) {
      await this._listenTunnel();
    }
    return new Promise(resolve =>
      this._tunnel.on('secureConnection', sock => {
        resolve(sock);
      }),
    );
  }

  get name() {
    return this._options.name;
  }

  get port() {
    return (this._server?.address() as net.AddressInfo)?.port;
  }
}
