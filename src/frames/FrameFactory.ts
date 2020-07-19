import { EventEmitter } from 'events';
import { MAGIC_BYTE } from '../consts/generic';
import { Frame } from './Frame';

/**
 * FrameFactory class
 * Used to aggregate and parse chunked data sent through socket
 * Use per socket connection.
 */
export class FrameFactory<T extends Frame> extends EventEmitter {
  private _chunks: Buffer = Buffer.alloc(0);
  private _expectedLength = 0;
  private _frameType = -1;

  constructor(private _factory: (buf: Buffer) => T) {
    super();
  }

  addChunk(buf: Buffer): void {
    if (buf.readUInt8(0) !== MAGIC_BYTE && this._chunks.length === 0) {
      return;
    }
    if (buf.readUInt8(0) !== MAGIC_BYTE) {
      const newChunk = buf.slice(0, this._expectedLength - this._chunks.length);
      this._chunks = Buffer.concat([this._chunks, newChunk]);
    } else {
      this._frameType = buf.readUInt8(1);
      this._expectedLength = buf.readUInt32LE(2);
      this._chunks = buf.slice(
        6,
        6 + Math.min(this._expectedLength, buf.length - 6),
      );
    }
    if (this._chunks.length === this._expectedLength) {
      const frame = this._factory(this._chunks);

      this.emit(frame.type, frame);
      setTimeout(() => this.dropLast());
    }
  }

  dropLast(): void {
    this._chunks = Buffer.alloc(0);
    this._expectedLength = 0;
    this._frameType = -1;
  }
}
