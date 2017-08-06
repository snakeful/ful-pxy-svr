const proxyServer = require('./index.js');
console.log('Running from testing');
console.log(proxyServer.app.ipAddress4);
console.log(proxyServer.app.ipAddress6);
proxyServer.runServer(90, true, true);