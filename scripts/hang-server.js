// Accepts connections but NEVER responds — forces the webhook client's 3s
// AbortController to fire, so we can prove the timeout caps the response.
const http = require('http');
const server = http.createServer(() => {
  // intentionally never call res.end()
});
server.listen(4001, () => console.log('hang server on :4001 (never responds)'));
