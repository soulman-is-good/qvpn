import log4js from 'log4js';
import { QVPNClient } from '../src/qvpn';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: {
    default: { appenders: ['console'], level: log4js.levels.INFO.levelStr },
  },
});

const main = async () => {
  const host = 'myqvpn.example.com';
  const port = 2222;
  const cli = new QVPNClient({
    authorizationToken: 'd5777241a6d74134b6c4fdf1c1d844af',
    serverHost: host,
    serverPort: port,
    connections: {
      localWebsite: {
        externalHost: 'localhost',
        externalPort: 8080,
      },
    },
  });

  await cli.start();
};

main();
