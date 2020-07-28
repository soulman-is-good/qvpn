import * as tls from 'tls';
import * as net from 'net';
import fs from 'fs';
import log4js from 'log4js';
import { FrameFactory, ServiceFrameType } from '../frames';

const log = log4js.getLogger('QTCPConnection');
const ca = fs.readFileSync('./rootCA.crt');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export interface QTCPConnectionOptions {
  name: string;
  internalHost: string;
  internalPort: number;
  externalHost: string;
  externalPort: number;
}
export class QTCPConnection {
  private _tunnel: tls.TLSSocket;
  private _options: QTCPConnectionOptions;

  constructor(options: QTCPConnectionOptions) {
    this._options = {
      ...options,
    };
  }

  start() {
    return Promise.all([
      new Promise((resolve, reject) => {
        this._tunnel = tls.connect(
          this._options.internalPort,
          this._options.internalHost,
          { ca },
          resolve,
        );
        this._tunnel.on('connect', this._onConnect.bind(this));
        this._tunnel.on('timeout', reject);
        this._tunnel.on('error', err => {
          reject(err);
          log.error(err);
        });
        this._tunnel.on('close', this._onClose.bind(this));
      }),
    ]).then(() => this._pipeData());
  }

  stop() {
    return Promise.all([new Promise(resolve => this._tunnel.end(resolve))]);
  }

  private _pipeData() {
    const ff = new FrameFactory<ServiceFrameType>();
    this._tunnel.on('data', buffer => {
      ff.addChunk(buffer);
    });
    const conns: { [key: number]: net.Socket } = {};

    ff.on('NEW', (_f, seq) => {
      if (conns[seq]) {
        return;
      }
      conns[seq] = net.connect(
        this._options.externalPort,
        this._options.externalHost,
      );
      conns[seq].on('error', err => {
        log.error(err);
      });
      conns[seq].on('data', buffer => {
        if (this._tunnel.writable) {
          this._tunnel.write(
            FrameFactory.toBuffer<ServiceFrameType>('DATA', buffer, seq),
          );
        }
      });
      conns[seq].on('close', () => {
        delete conns[seq];
        this._tunnel.write(
          FrameFactory.toBuffer<ServiceFrameType>('END', Buffer.alloc(0), seq),
        );
      });
    });
    ff.on('DATA', (frame, seq) => {
      log.debug(`< DATA frame #${seq}`);
      if (conns[seq]?.writable) {
        conns[seq].write(frame.payload);
      }
    });
    ff.on('END', (_f, seq) => {
      log.debug(`< END frame #${seq}`);
      if (conns[seq]?.writable) {
        conns[seq].end();
      }
    });
  }

  private _onClose(error: boolean) {
    log.info(
      `Service ${this._options.name} closed conneciton to ${
        this._options.internalHost
      }:${this._options.internalPort}${error ? ' with error' : ''}`,
    );
    this._tunnel = null;
  }

  private _onConnect() {
    log.info(
      `Service ${this._options.name} connecited to ${this._options.internalHost}:${this._options.internalPort}`,
    );
  }
}
