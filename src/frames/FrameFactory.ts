import { EventEmitter } from 'events';
import { MAGIC_BYTE } from '../consts/generic';
import { Frame } from './Frame';

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
    let offset = 0;

    console.log(buf.toString())
    while (offset < buf.length) {
      if (buf.readUInt8(offset) !== MAGIC_BYTE) {
        offset += 1;

        continue;
      }
      const seq = buf.readUInt8(offset + 1);
      const fSeq = buf.readUInt8(offset + 2);
      const len = buf.readUInt32LE(offset + 3);

      this._lastSeq = seq;
      if (!this._chunks[seq]) {
        this._chunks[seq] = [];
      }
      this._chunks[seq][fSeq] = buf.slice(
        offset + HEADER_SIZE,
        offset + HEADER_SIZE + Math.min(len, buf.length - HEADER_SIZE),
      );
      const result = Buffer.concat(this._chunks[seq].filter(Buffer.isBuffer));

      offset += this._chunks[seq][fSeq].length;
      if (result.byteLength === len) {
        const frame = Frame.fromData(result);

        this.emit(frame.type, frame, seq);
        delete this._chunks[seq];
      }
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
