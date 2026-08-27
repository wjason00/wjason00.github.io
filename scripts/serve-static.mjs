import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function fileFor(requestUrl) {
  const pathname = new URL(requestUrl || '/', 'http://127.0.0.1').pathname;
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  let target = resolve(root, normalized || 'index.html');
  const relativeTarget = relative(root, target);
  if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..') return null;

  try {
    if (statSync(target).isDirectory()) target = join(target, 'index.html');
  } catch {
    return null;
  }
  return target;
}

const server = createServer((request, response) => {
  const file = fileFor(request.url);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes.get(extname(file).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).on('error', () => {
    if (!response.headersSent) response.writeHead(404);
    response.end('Not found');
  }).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
