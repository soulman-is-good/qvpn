import * as fs from 'fs';
import log4js from 'log4js';
import { QVPNServer } from '../src/qvpn';
import data from '../data/clients.json';

log4js.configure({
  appenders: { console: { type: 'console' } },
  categories: {
    default: { appenders: ['console'], level: log4js.levels.INFO.levelStr },
  },
});

const main = async () => {
  const host = '0.0.0.0';
  const port = 8080;
  const srv = new QVPNServer({
    host,
    port,
    dataProvider: () => data,
/*    serviceTLSOptions: {
      ca: fs.readFileSync('./rootCA.crt'),
      cert: fs.readFileSync('./server.crt'),
      key: fs.readFileSync('./server.key'),
    },*/
  });

  await srv.start();
};

main();
