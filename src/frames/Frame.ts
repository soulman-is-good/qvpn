export const CONTROL_CHAR = 0xff;

export class Frame<T extends string> {
  private _type: T;
  private _payload: Buffer;

  static fromData(buffer: Buffer) {
    const index = buffer.findIndex(byte => byte === CONTROL_CHAR);
    const type = buffer.subarray(0, index).toString();
    const payload = buffer.subarray(index + 1);

    return new Frame(type, payload);
  }

  constructor(type: T, payload: Buffer) {
    this._type = type;
    this._payload = payload;
  }

  toBuffer() {
    return Buffer.concat([
      Buffer.from(this._type),
      Buffer.from([CONTROL_CHAR]),
      this._payload,
    ]);
  }

  get type(): string {
    return this._type;
  }

  get payload(): Buffer {
    return this._payload;
  }
}
