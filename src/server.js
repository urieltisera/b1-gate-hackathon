import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Gate } from './core.js';

const gate = new Gate();
const page = await readFile(fileURLToPath(new URL('./ui.html', import.meta.url)), 'utf8');
const port = Number(process.env.PORT || 3030);
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(page); }
  if (req.method === 'GET' && req.url === '/api/state') return json(res, 200, { jobs: [...gate.jobs.values()].map(j => structuredClone(j)), ledger: gate.ledger, ledgerValid: gate.verifyLedger() });
  if (req.method !== 'POST' || !['/api/propose', '/api/approve', '/api/execute'].includes(req.url)) return json(res, 404, { error: 'Not found' });
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 10000) throw Error('Request too large'); }
    const input = JSON.parse(raw);
    let result;
    if (req.url === '/api/propose') result = gate.propose(input.effect);
    if (req.url === '/api/approve') result = gate.approve(input.id, input.effectHash);
    if (req.url === '/api/execute') {
      const job = gate.get(input.id);
      result = gate.execute(input.id, input.effect ?? job?.effect);
    }
    json(res, 200, result);
  } catch (err) { json(res, 400, { error: err.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`B1 Gate local demo: http://127.0.0.1:${port}`));
