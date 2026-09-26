const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = __dirname;
const host = '127.0.0.1';
const port = 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};
const allowed = new Set(['index.html', 'style.css', 'app.js', 'stuecke.json', 'favicon.ico', 'favicon.svg']);

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${host}:${port}`).pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const filename = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!allowed.has(filename)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  try {
    const contents = await fs.readFile(path.join(root, filename));
    res.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
});

server.on('error', error => {
  console.error(`Could not start the development server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`NotaBene: http://${host}:${port}/ (Ctrl+C to stop)`));
