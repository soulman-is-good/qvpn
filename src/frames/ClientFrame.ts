import { Frame } from './Frame';

export type ClientFrameType = 'PORTS';

export class ClientFrame extends Frame {
  static TYPES: Record<ClientFrameType, ClientFrameType> = {
    PORTS: 'PORTS',
  };
}
