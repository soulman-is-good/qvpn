import log4js from 'log4js';
import { QVPNServer, QVPNClient } from '../src/qvpn';
import data from '../data/clients.json';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: {
    default: { appenders: ['console'], level: log4js.levels.ALL.levelStr },
  },
});

const main = async () => {
  const host = 'localhost';
  const port = 3333;
  const srv = new QVPNServer({
    host,
    port,
    dataProvider: () => data,
  });
  const cli = new QVPNClient({
    authorizationToken: 'd5777241a6d74134b6c4fdf1c1d844af',
    serverHost: host,
    serverPort: port,
    connections: {
      'http connection': {
        externalHost: 'localhost',
        externalPort: 8000,
      },
    },
  });

  await srv.start();
  await cli.start();
};

main();
