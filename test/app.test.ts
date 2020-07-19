import { createConnection } from 'net';
import { assert } from 'chai';
import { QVPNServer } from '../src/qvpn';
import { MAGIC_BYTE } from '../src/consts/generic';
import { FrameFactory, ClientFrame } from '../src/frames';

describe('Application test', () => {
  const PORT = 3333;
  let server!: QVPNServer;

  after(async () => {
    await server.stop();
  });

  it('should start server', async () => {
    server = new QVPNServer(PORT);

    await server.start();
    assert.isUndefined(server.getLastError());
  });

  it('should authorize client', async () => {
    const socket = createConnection(PORT);
    const buffer = Buffer.concat([
      Buffer.from('AUTH'),
      Buffer.from([0xff]),
      Buffer.from('d5777241a6d74134b6c4fdf1c1d844af'),
    ]);
    const magic = Buffer.from([MAGIC_BYTE]);
    const frameType = Buffer.from([0x01]);
    const length = Buffer.alloc(4);
    const frames = new FrameFactory(buf => ClientFrame.fromData(buf));

    length.writeUInt32LE(buffer.length, 0);

    socket.write(Buffer.concat([magic, frameType, length, buffer]));
    socket.on('data', data => frames.addChunk(data));
    await new Promise(resolve =>
      frames.on(ClientFrame.TYPES.PORTS, (frame: ClientFrame) => {
        assert.include(frame.payload.toString(), 'http connection:');
        resolve();
      }),
    );
  });
});
