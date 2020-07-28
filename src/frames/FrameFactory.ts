import { EventEmitter } from 'events';
import { MAGIC_BYTE } from '../consts/generic';
import { Frame } from './Frame';

/**
 * FrameFactory class
 * Used to aggregate and parse chunked data sent through socket
 * Use per socket connection.
 */
export class FrameFactory<T extends string> extends EventEmitter {
  private _chunks: Buffer = Buffer.alloc(0);
  private _expectedLength = 0;

  constructor(private _sequence = -1) {
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
      if (this._sequence !== -1 && this._sequence !== buf.readUInt8(1)) {
        return;
      }
      this._sequence = buf.readUInt8(1);
      this._expectedLength = buf.readUInt32LE(2);
      this._chunks = buf.slice(
        6,
        6 + Math.min(this._expectedLength, buf.length - 6),
      );
    }
    if (this._chunks.length === this._expectedLength) {
      const frame = Frame.fromData(this._chunks);

      this.emit(frame.type, frame, this._sequence);
      setTimeout(() => this.dropLast());
    }
  }

  on(event: T, listener: (frame: Frame<T>, seq: number) => void) {
    super.on(event, listener);

    return this;
  }

  static toBuffer<T extends string>(
    type: T,
    payload = Buffer.alloc(0),
    sequence = 0,
  ) {
    const frame = new Frame(type, payload).toBuffer();
    const lengthBuf = Buffer.alloc(4);

    lengthBuf.writeUInt32LE(frame.byteLength, 0);

    return Buffer.concat([
      Buffer.from([MAGIC_BYTE]), // Definition byte
      Buffer.from([sequence % 0xff]), // Frame type (not used yet)
      lengthBuf, // Length of payload
      frame, // payload
    ]);
  }

  dropLast(): void {
    this._chunks = Buffer.alloc(0);
    this._expectedLength = 0;
    this._sequence = -1;
  }
}
