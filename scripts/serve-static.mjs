import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 4173);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
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
  if (relativeTarget.startsWith(`..${sep}`) || relativeTarget === '..' || isAbsolute(relativeTarget)) return null;

  try {
    if (statSync(target).isDirectory()) target = join(target, 'index.html');
  } catch {
    return null;
  }
  return target;
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const last = BigInt(size - 1);
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (suffix === 0n) return null;
    return { start: Number(suffix > last ? 0n : last + 1n - suffix), end: size - 1 };
  }
  const start = BigInt(match[1]);
  const requestedEnd = match[2] ? BigInt(match[2]) : last;
  const end = requestedEnd > last ? last : requestedEnd;
  return start > end ? null : { start: Number(start), end: Number(end) };
}

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': '0' }).end();
    return;
  }

  let file;
  let size;
  try {
    file = fileFor(request.url);
    if (!file) throw new Error('Missing file');
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('Not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  const headers = {
    'Content-Type': contentTypes.get(extname(file).toLowerCase()) || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(size),
  };
  // Range applies to GET only. HEAD reports the complete representation's size.
  const rangeHeader = request.headers.range;
  const requestedRange = request.method === 'GET' && !request.headers['if-range'] && /^bytes=/i.test(rangeHeader || '')
    ? rangeHeader
    : undefined;
  const range = requestedRange ? byteRange(requestedRange, size) : undefined;
  if (requestedRange && range === null) {
    response.writeHead(416, {
      ...headers,
      'Content-Range': `bytes */${size}`,
      'Content-Length': '0',
    }).end();
    return;
  }
  if (range) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
    headers['Content-Length'] = String(range.end - range.start + 1);
  }
  response.writeHead(range ? 206 : 200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file, range || {}).on('error', () => {
    // A file disappearing after stat cannot be replaced by a different-length body.
    response.destroy();
  }).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
