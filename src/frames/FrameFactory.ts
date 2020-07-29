import { EventEmitter } from 'events';
import log4js from 'log4js';
import { MAGIC_BYTE } from '../consts/generic';
import { Frame } from './Frame';

const log = log4js.getLogger('FrameFactory');
/**
 * Header size
 * | # | Length | Description |
 * |---|---|---|
 * | 0 | 1 | Magic byte defining a frame |
 * | 1 | 1 | Global sequence number |
 * | 2 | 1 | Frame sequence number |
 * | 3 | 4 | Lenth of data buffer |
 */
const HEADER_SIZE = 7;

/**
 * FrameFactory class
 * Used to aggregate and parse chunked data sent through socket
 * Use per socket connection.
 */
export class FrameFactory<T extends string> extends EventEmitter {
  private _chunks: Buffer[][] = [];
  private _lastSeq = 0;

  addChunk(buf: Buffer): void {
    if (buf.readUInt8(0) !== MAGIC_BYTE) {
      log.warn(
        `Malformed buffer. Check window config. Length: ${buf.byteLength}`,
      );

      return;
    }
    const seq = buf.readUInt8(1);
    const fSeq = buf.readUInt8(2);
    const len = buf.readUInt32LE(3);

    this._lastSeq = seq;
    if (!this._chunks[seq]) {
      this._chunks[seq] = [];
    }
    this._chunks[seq][fSeq] = buf.slice(
      HEADER_SIZE,
      HEADER_SIZE + Math.min(len, buf.length - HEADER_SIZE),
    );
    const result = Buffer.concat(this._chunks[seq].filter(Buffer.isBuffer));

    if (result.byteLength === len) {
      const frame = Frame.fromData(result);

      this.emit(frame.type, frame, seq);
      delete this._chunks[seq];
    }
  }

  on(event: T, listener: (frame: Frame<T>, seq: number) => void) {
    super.on(event, listener);

    return this;
  }

  static toBufferStack<T extends string>(
    type: T,
    payload = Buffer.alloc(0),
    sequence = 0,
    frameSize = 16384, // 16 Kb
  ) {
    const frame = new Frame(type, payload).toBuffer();
    const lengthBuf = Buffer.alloc(4);

    lengthBuf.writeUInt32LE(frame.byteLength, 0);

    const dataSize = frameSize - HEADER_SIZE;
    const framesCount = Math.ceil(frame.byteLength / dataSize);
    const frames = [];
    let i = 0;

    while (i < framesCount) {
      const buf = Buffer.concat([
        Buffer.from([MAGIC_BYTE]), // Definition byte
        Buffer.from([sequence % 0xff]), // Global seq
        Buffer.from([i % 0xff]), // Frame seq
        lengthBuf, // Length of payload
        frame.slice(i * dataSize, (i + 1) * dataSize), // payload
      ]);

      frames.push(buf);
      i += 1;
    }

    return frames;
  }

  dropLast() {
    delete this._chunks[this._lastSeq];
  }
}
