import { Frame } from './Frame';

export type ClientFrameType = 'PORTS' | 'PONG';

export class ClientFrame extends Frame {
  static TYPES: Record<ClientFrameType, ClientFrameType> = {
    PORTS: 'PORTS',
    PONG: 'PONG',
  };
}
