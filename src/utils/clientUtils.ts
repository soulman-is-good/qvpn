import { ClientData } from '../interfaces/ClientData';

export const findClientById = (data: ClientData[], clientId: string) =>
  data.find(cli => cli.client_id === clientId);
