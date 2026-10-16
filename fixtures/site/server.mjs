import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'public');
const HOST = '127.0.0.1';
const PORT = Number(process.env.P0_PORT ?? 4317);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('P0_PORT must be 1-65535');
  process.exit(2);
}
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const data = [
  { id: 'a', title: 'Rose Chrome', category: 'chrome', score: 93, days: 7 },
  { id: 'b', title: 'Blue French', category: 'french', score: 65, days: 30 },
  { id: 'c', title: 'Amber Jelly', category: 'jelly', score: 88, days: 7 },
  { id: 'd', title: 'Mint Chrome', category: 'chrome', score: 79, days: 30 },
];
const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
};
export function createFixtureServer() {
  return createServer(async (req, res) => {
    if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
    let url;
    try { url = new URL(req.url, `http://${HOST}:${PORT}`); } catch { return send(res, 400, { error: 'bad_url' }); }
    if (url.pathname === '/health') return send(res, 200, { ok: true, fixture: 'p0-1' });
    if (url.pathname === '/api/trends') {
      const days = Number(url.searchParams.get('days') ?? '7');
      const q = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
      const category = url.searchParams.get('category') ?? 'all';
      if (![7, 30].includes(days)) return send(res, 400, { error: 'invalid_days' });
      if (!['all', 'chrome', 'french', 'jelly'].includes(category)) return send(res, 400, { error: 'invalid_category' });
      const filtered = data.filter(row => row.days <= days && (category === 'all' || row.category === category) && row.title.toLocaleLowerCase().includes(q));
      return send(res, 200, { days, category, q, count: filtered.length, items: filtered });
    }
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.js', 'style.css'].includes(name)) return send(res, 404, { error: 'not_found' });
    try { const content = await readFile(join(ROOT, name), 'utf8'); send(res, 200, content, contentTypes[extname(name)]); }
    catch { send(res, 500, { error: 'fixture_missing' }); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = createFixtureServer();
  server.listen(PORT, HOST, () => console.log(`P0 fixture ready: http://${HOST}:${PORT}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
}
