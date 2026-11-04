import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function sha256(text) { return createHash('sha256').update(text).digest('hex'); }
export function effectHash(effect) { return sha256(canonical(effect)); }
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export class Gate {
  constructor() { this.jobs = new Map(); this.ledger = []; this.prevHash = '0'.repeat(64); }
  record(type, details) {
    const entry = { seq: this.ledger.length + 1, time: new Date().toISOString(), type, details, previousHash: this.prevHash };
    entry.hash = sha256(canonical(entry));
    this.prevHash = entry.hash;
    this.ledger.push(entry);
    return entry;
  }
  propose(effect) {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) throw Error('Invalid effect');
    const allowedKeys = ['action', 'repository', 'title', 'body'];
    if (Object.keys(effect).some(k => !allowedKeys.includes(k))) throw Error('Unsupported effect property');
    if (effect.action !== 'github.create_draft_pr') {
      this.record('DENY', { reason: 'Action not allowed', action: effect.action ?? null });
      throw Error('Action not allowed');
    }
    if (effect.repository !== 'urieltisera/b1-gate2-demo') {
      this.record('DENY', { reason: 'Repository not allowed', repository: effect.repository ?? null });
      throw Error('Repository not allowed');
    }
    if (typeof effect.title !== 'string' || !effect.title.trim() || effect.title.length > 120 ||
        typeof effect.body !== 'string' || effect.body.length > 1000) throw Error('Invalid title or body');
    const frozen = structuredClone(effect);
    const job = { id: randomUUID(), effect: frozen, effectHash: effectHash(frozen), status: 'REQUIRE_APPROVAL', ticket: null, receipt: null };
    this.jobs.set(job.id, job);
    this.record('REQUIRE_APPROVAL', { jobId: job.id, effectHash: job.effectHash });
    return structuredClone(job);
  }
  approve(id, approvedHash) {
    const job = this.jobs.get(id);
    if (!job) throw Error('Job not found');
    if (job.status !== 'REQUIRE_APPROVAL') throw Error('Approval is not pending');
    if (!safeEqual(approvedHash, job.effectHash)) {
      this.record('DENY', { jobId: id, reason: 'Approval hash mismatch' });
      throw Error('Approval hash mismatch');
    }
    job.ticket = { id: randomUUID(), jobId: id, effectHash: job.effectHash, issuedAt: new Date().toISOString() };
    job.status = 'APPROVED';
    this.record('APPROVED', { jobId: id, ticketId: job.ticket.id, effectHash: job.effectHash });
    return structuredClone(job);
  }
  execute(id, presentedEffect) {
    const job = this.jobs.get(id);
    if (!job) throw Error('Job not found');
    if (job.status !== 'APPROVED' || !job.ticket) throw Error('Not approved');
    if (!safeEqual(effectHash(presentedEffect), job.ticket.effectHash) ||
        !safeEqual(effectHash(job.effect), job.ticket.effectHash)) {
      this.record('DENY', { jobId: id, reason: 'Effect changed after approval' });
      throw Error('Effect changed after approval');
    }
    // Demo-only executor: deliberately has no GitHub write credentials.
    job.receipt = { executor: 'local_simulator', simulated: true, result: 'DRAFT_PR_SIMULATED', effectHash: job.effectHash };
    job.status = 'VERIFIED_SIMULATION';
    this.record('EXECUTED_SIMULATION', { jobId: id, receipt: job.receipt });
    this.record('VERIFIED', { jobId: id, evidence: 'local receipt; NOT a remote GitHub PR' });
    return structuredClone(job);
  }
  verifyLedger() {
    let previous = '0'.repeat(64);
    for (let i = 0; i < this.ledger.length; i++) {
      const { hash, ...entry } = this.ledger[i];
      if (entry.seq !== i + 1 || entry.previousHash !== previous || !safeEqual(hash, sha256(canonical(entry)))) return false;
      previous = hash;
    }
    return true;
  }
  get(id) { const job = this.jobs.get(id); return job ? structuredClone(job) : null; }
}
