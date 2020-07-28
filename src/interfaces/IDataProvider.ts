import { ClientData } from './ClientData';

export type IDataProvider = () => PromiseLike<ClientData[]> | ClientData[];
