const cluster = require('cluster');
const processors = require('os').cpus();
const port  = parseInt(process.argv[2] || process.env.port || 80);
if (cluster.isMaster) {
  const { discoveryServer } = require('./discovery.js');
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
    console.log(`Worker ${worker.process.pid} exited. Launching new process.`);
    setTimeout(() => {
      if (!worker.exitedAfterDisconnect) {
        cluster.fork();
      }
    }, 500);
  });
} else {
  const { server } =  require('./index');
  console.log(`Running worker ${process.pid} from testing`);
  process.on('message', function (msg) {
    msg.cmd && msg.cmd === 'read-sockets' && server.readSockets();
  });
  server.run(port, true);
}