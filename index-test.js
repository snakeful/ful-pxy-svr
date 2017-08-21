const { server } = require('./index.js');
console.log('Running from testing');
server.runDiscoveryServer = true;
server.use((req, res, next) => {
  console.log('I\'m a middleware function');
  next();
});
server.run(process.argv[2], true);