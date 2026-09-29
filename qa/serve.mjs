// Local static server that mirrors the Vercel deployment: serves ../site with the headers from site/vercel.json.
// Usage: bun qa/serve.mjs [port]   (default 4173)
import { join, normalize } from 'node:path';

const root = join(import.meta.dir, '..', 'site');
const config = await Bun.file(join(root, 'vercel.json')).json();
const rules = config.headers.map((rule) => ({ re: new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '.*').replace(/\((\w+(?:\|\w+)*)\)/g, '($1)') + '$'), headers: rule.headers }));
const port = Number(process.argv[2] ?? 4173);

Bun.serve({
  port,
  async fetch(req) {
    const path = decodeURIComponent(new URL(req.url).pathname);
    const rel = normalize(path === '/' ? '/index.html' : path);
    if (rel.includes('..') || rel === '/vercel.json') return new Response('Not Found', { status: 404 });
    const file = Bun.file(join(root, rel));
    if (!(await file.exists())) return new Response('Not Found', { status: 404 });
    const headers = new Headers({ 'Cache-Control': 'public, max-age=0, must-revalidate' });
    for (const rule of rules) if (rule.re.test(path)) for (const h of rule.headers) headers.set(h.key, h.value);
    return new Response(file, { headers });
  },
});
console.log(`serving ${root} on http://localhost:${port}`);
