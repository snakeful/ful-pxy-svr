# Ful Proxy Server
A proxy server to load balance webpages or microservices with service discovery functionality

# npm
To install it in your proyect
```npm
npm install ful-pxy-svr --save
```

# Features
* Proxy requests through this server.
* Discovery service to register a host with port.
* Middleware functions to add functionality before making proxy request to target socket.

# Quick start
```
const { server } = require('ful-pxy-svr');
proxy.dirname = <path of the directory to save sockets address book>;
server.runDiscoveryServer = true; // Run the discovery microservice
/* Default port: 80 or port in process.env.port */
/* Default list false, will use default socket list with true value */
server.use(function (req, res, next) {
  console.log('I\'m a middleware function');
  next();
});
server.run(3000, true, true);
```

# Quick start clustered environment
```
const cluster = require('cluster');
const processors = require('os').cpus();
const port  = 3000;
if (cluster.isMaster) {
  const { discoveryServer } = require('ful-pxy-svr/discovery');
  discoveryServer.run(port + 1);
  for (let processorId = 0; processorId < processors.length; processorId++) {
    cluster.fork();
  }
  discoveryServer.sendMessages = () => {
    for (let workerId in cluster.workers) {
      cluster.workers[workerId].send({ cmd: 'read-sockets' });
    }
  }
  discoveryServer.sendMessages();
  cluster.on('exit', (worker, code, signal) => {
    setTimeout(() => {
      if (!worker.exitedAfterDisconnect) {
        cluster.fork();
      }
    }, 500);
  });
} else {
  const { server } =  require('ful-pxy-svr');
  process.on('message', function (msg) {
    msg.cmd && msg.cmd === 'read-sockets' && server.readSockets();
  });
  server.use(function (req, res, next) {
    console.log(`I\'m a middleware function from worker ${process.pid}`);
    next();
  });
  server.run(port, true);
}
```

# 