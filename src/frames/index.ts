export type MaintainceFrameType = 'AUTH' | 'PING';
export type ClientFrameType = 'PORTS' | 'PONG';
export type ServiceFrameType = 'NEW' | 'DATA' | 'END';

export * from './FrameFactory';
