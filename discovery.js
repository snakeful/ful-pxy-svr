(() => {
  'use strict';
  const fs = require('fs');
  const express = require('express');
  const path = require('path');
  const server = express();
  const appRouter = express.Router();
  server.use(require('helmet')());
  server.use(require('cors')());
  server.use(require('body-parser').json());
  server.use(require('compression')());
  server.use('/api', appRouter);
  server.dirname = __dirname;
  server.configDir = 'config';
  server.adbFile = 'sockets-adb.json'; 
  server.socketList = {};
  function getConfigDir () {
    return path.join(server.dirname, server.configDir);
  };

  function getConfigFile () {
    return path.join(server.dirname, server.configDir, server.adbFile);
  };

  function readSockets () {
    try {
      if (!fs.existsSync(getConfigDir())) {
        fs.mkdirSync(getConfigDir());
      }
      if (!fs.existsSync(getConfigFile())) {
        fs.writeFileSync(getConfigFile(), JSON.stringify({
          default: {
            sockets: [],
            curr: 0
          }
        }));
      }
      Object.assign(server.socketList, JSON.parse(fs.readFileSync(getConfigFile(), 'utf8')));
      console.log('Sockets loaded.');
    } catch (ex) {
      throw ex;
    }
  };

  function writeSockets () {
    try {
      fs.writeFileSync(getConfigFile(), JSON.stringify(server.socketList));
      console.log('Sockets saved.');
      if (server.sendMessages) {
        server.sendMessages();
      }
    } catch (ex) {
      throw ex;
    }
  };

  appRouter.get('/status', (req, res) => {
    if (req.query.all === 'true') {
      return res.json({
        id: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: process.cpuUsage()
      });
    }
    res.json({
      uptime: process.uptime()
    });
  });

  appRouter.get('/sockets', (req, res) => {
    res.json(server.socketList);
  });

  appRouter.get('/sockets/:id', (req, res) => {
    if (!server.socketList[req.params.id]) {
      return res.status(404).send('Sockets not found.');
    }
    res.json(server.socketList[req.params.id]);
  });

  appRouter.post('/sockets', (req, res) => {
    if (!req.body || (req.body && (!req.body.host || !req.body.port))) {
      return res.status(404).json({
        err: 'Socket not sent. Payload structure: {"host":"<host>", "port": <port>}'
      });
    }
    let sockets = server.socketList[req.headers['x-socket-id'] || 'default'];
    if (!sockets) {
      sockets = {
        sockets: [],
        curr: 0
      };
      server.socketList[req.headers['x-socket-id'] || 'default'] = sockets;
    }
    let exist = false;
    sockets.sockets.forEach((socket) => {
      if ((socket.host === req.body.host) && (socket.port === parseInt(req.body.port))) {
        exist = true;
      }
    });
    if (!exist) {
      sockets.sockets.push({
        host: req.body.host,
        port: parseInt(req.body.port)
      });
    }
    res.status(200).send(true);
    writeSockets();
  });

  // Must send like query params host and port
  appRouter.delete('/sockets', (req, res) => {
    if (!req.query.host || !req.query.port) {
      let error = {
        error: `Socket host or port not sent.`
      };
      return res.status(400).json();
    }
    let sockets = server.socketList[req.headers['x-socket-id'] || 'default'];
    let found = false;
    if (!sockets) {
      return res.status(404).json({
        error: `Socket not found ${req.headers['x-socket-id']}`
      });
    }
    sockets.sockets.forEach((socket, index) => {
      if ((socket.host === req.query.host) && (socket.port === parseInt(req.query.port))) {
        sockets.sockets.splice(index, 1);
        found = true;
        writeSockets();
      }
    });
    sockets.curr = sockets.sockets.length;
    res.status(found ? 200 : 404).send(found || `Socket ${req.query.host}:${req.query.port} not found.`);
  });

  server.run = function (port) {
    readSockets();
    this.port = parseInt(port || process.env.port || 80);
    this.listen(this.port, () => {
      console.log(`Discovery Server on port ${this.port}`);
    });
  };
  module.exports = {
    discoveryServer: server,
    readSockets: readSockets
  };
})();