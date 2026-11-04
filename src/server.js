import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Gate } from './core.js';
import { createDraftPr, probe } from './github.js';
import { museProposal } from './meta.js';

const real = process.env.B1_REAL_EXECUTION === '1';
const approvalCode = randomBytes(5).toString('hex');
const gate = new Gate({ approvalCode });
const page = await readFile(fileURLToPath(new URL('./ui.html', import.meta.url)), 'utf8');
const port = Number(process.env.PORT || 3030);
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  const route = req.url?.split('?')[0];
  if (req.method === 'GET' && route === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(page); }
  if (req.method === 'GET' && route === '/api/state') return json(res, 200, { mode: real ? 'REAL_GITHUB' : 'SIMULATION', jobs: [...gate.jobs.values()].map(j => structuredClone(j)), ledger: gate.ledger, ledgerValid: gate.verifyLedger() });
  if (req.method !== 'POST' || !['/api/propose', '/api/approve', '/api/execute', '/api/reconcile', '/api/meta/propose'].includes(route)) return json(res, 404, { error: 'Not found' });
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 10000) throw Error('Request too large'); }
    const input = JSON.parse(raw);
    let result;
    if (route === '/api/meta/propose') result = gate.propose(await museProposal(input.request));
    if (route === '/api/propose') result = gate.propose(input.effect);
    if (route === '/api/approve') result = gate.approve(input.id, input.effectHash, input.approvalCode);
    if (route === '/api/execute') {
      const job = gate.get(input.id);
      if (!job) throw Error('Job not found');
      if (real) {
        const started = gate.beginReal(input.id, input.effect ?? job.effect);
        try { const verified = await createDraftPr(started); result = gate.finishReal(job.id, verified, verified.verified); }
        catch (err) { result = gate.finishReal(job.id, { reason: 'Remote result uncertain; reconcile before any retry', diagnostic: String(err.message).slice(0, 240) }, false); }
      } else result = gate.execute(input.id, input.effect ?? job.effect);
    }
    if (route === '/api/reconcile') {
      if (!real) throw Error('Real mode disabled');
      const job = gate.get(input.id);
      if (!job || job.status !== 'EFFECT_UNKNOWN') throw Error('Only unknown effects can be reconciled');
      const evidence = await probe(job.id);
      result = evidence.verified ? gate.finishReal(job.id, evidence, true) : { ...job, evidence, note: 'No retry: investigate GitHub manually' };
    }
    json(res, 200, result);
  } catch (err) { json(res, 400, { error: err.message }); }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`B1 Gate v0.2: http://127.0.0.1:${port} | Mode: ${real ? 'REAL_GITHUB' : 'SIMULATION'}`);
  console.log(`Operator approval code (do not share): ${approvalCode}`);
});
