(() => {
  'use require';
  const http = require('http');
  const proxyServer = require('http-proxy');
  const ifaces = require('os').networkInterfaces();
  const { discoveryServer, readSockets } = require('./discovery');
  let useDefaultList = false;
  let socketList;
  function sendError(res, err) {
    res.writeHeader(500);
    res.write(JSON.stringify({
      error: err
    }));
    res.end();
  };

  function checkServiceHealth(options) {
    let http = require('http');
    return new Promise((resolve, reject) => {
      let req = http.request(options, (res) => {
        res.on('data', (data) => {
          console.log(`Data: ${data}`);
        });

        res.on('end', () => {
          console.log(`Status: ${res.statusCode}`);
          if (res.statusCode !== 200) {
            return reject(res);
          }
          resolve();
        });
      });
      req.on('error', (error) => {
        reject({
          message: error
        });
      });
      req.end();
    });
  };

  let proxy = proxyServer.createProxyServer({});
  const server = http.createServer(function (req, res) {
    try {
      if (['OPTIONS', 'HEAD'].indexOf(req.method) !== -1) {
        let headers = {};
        headers['access-control-allow-origin'] = '*';
        headers['access-control-allow-headers'] = 'Content-Type, Content-Length, Authorization, Accept, X-Request-With, x-socket-id';
        headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        res.writeHeader(200, headers);
        return res.end();
      }

      let sockets = this.socketList[req.headers['x-socket-id'] || 'default'];
      if (!sockets && (useDefaultList === 'true')) {
        sockets = this.socketList['default'];
      }
      if (!sockets) {
        res.writeHeader(404, res.headers)
        res.write(JSON.stringify({
          error: req.headers['x-socket-id'] ? `Socket Id ${req.headers['x-socket-id']} not found.` : 'Socket id for proxying not sent on headers x-socket-id.'
        }));
        return res.end();
      }
      sockets.curr = (sockets.curr + 1) % sockets.sockets.length || 0;
      let target = sockets.sockets[sockets.curr];
      if (!target) {
        res.writeHeader(400);
        res.write(JSON.stringify({
          error: `No sockets registered. Id ${req.headers['x-socket-id'] || 'default'}`
        }));
        return res.end();
      }
      let address = req.socket.remoteAddress.split(':');
      function proxyTarget () {
        proxy.web(req, res, {
          target: target
        }, (err) => {
          console.log(`Error: ${JSON.stringify(err, null, ' ')}`);
          sendError(res, err);
        });
      }
      console.log(`${address[address.length - 1]}:${req.socket.remotePort} fowarding to ${target.host}:${target.port}`);
      checkServiceHealth({
        host: target.host,
        port: target.port,
        path: '/api/status'
      }).then(() => {
        proxyTarget();
      }, (err) => {
        sendError(res, `Cannot check health for service on ${target.host}:${target.port}. Error: ${err.message}`);
      });
    } catch (ex) {
      sendError(res, ex.message);
    }
  });

  // Get the ipv4 address from which the server is running
  Object.keys(ifaces).forEach((ifname) => {
    ifaces[ifname].forEach((iface) => {
      if (!server.ipAddress4 && iface.family === 'IPv4' && iface.internal) {
        server.ipAddress4 = iface.address;
      }
      if (!server.ipAddress6 && iface.family === 'IPv6' && iface.internal) {
        server.ipAddress6 = iface.address;
      }
    });
  });

  server.run = function (port, useDefScktList = false) {
    useDefaultList = useDefScktList;
    this.port = parseInt(port || process.env.port || 80);
    this.listen(this.port, () => {
      console.log(`Proxy server on port ${this.port}`);
    });
    if (this.runDiscoveryServer) {
      discoveryServer.run(this.port + 1);
    }
    this.readSockets = readSockets;
    this.socketList = discoveryServer.socketList;
  };
  module.exports = {
    server: server,
    discoveryServer: discoveryServer
  }
})();