const http = require('http');

const req = http.request({
  hostname: '127.0.0.1',
  port: 49687,
  path: '/v1/models',
  method: 'GET'
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', e => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
