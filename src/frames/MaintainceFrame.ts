import { Frame } from './Frame';

export type MaintainceFrameType = 'AUTH' | 'PING';

export class MaintainceFrame extends Frame {
  static TYPES: Record<MaintainceFrameType, MaintainceFrameType> = {
    AUTH: 'AUTH',
    PING: 'PING',
  };
}
