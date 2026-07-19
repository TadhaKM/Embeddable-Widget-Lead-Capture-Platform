// Mock webhook receiver for live verification.
// POST /webhook -> append {timestamp, body} to ../webhook-received.log, respond 200.
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG = path.join(__dirname, '..', 'webhook-received.log');
const PORT = 4000;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = body;
      }
      const line =
        JSON.stringify({ timestamp: new Date().toISOString(), body: parsed }) +
        '\n';
      fs.appendFileSync(LOG, line);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`mock webhook receiver listening on http://localhost:${PORT}/webhook`);
});
