const { server } = require('./index.js');
console.log('Running from testing');
server.runDiscoveryServer = true;
server.run(process.argv[2], true, true);