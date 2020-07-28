/* eslint-disable camelcase */
export type ClientService = {
  name: string;
  /**
   * Communication between QVPN Client and QVPN Server
   */
  internalPort: number;
  /**
   * Exposed service port for user
   */
  externalPort: number;
};

export type ClientData = {
  client_id: string;
  client_title: string;
  client_services: ClientService[];
};
