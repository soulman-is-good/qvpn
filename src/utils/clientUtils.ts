import ClientsData from '../../data/clients.json';

export type ClientService = typeof ClientsData[number]['client_services'][0];

export const findClientById = (clientId: string) =>
  ClientsData.find(cli => cli.client_id === clientId);
