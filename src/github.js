import { spawn } from 'node:child_process';

const REPO = 'urieltisera/b1-gate2-demo';
const prefix = `/repos/${REPO}`;

export function ghApi(endpoint, method = 'GET', body = null, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const args = ['api', endpoint, '-X', method];
    if (body !== null) args.push('--input', '-');
    const proc = spawn(process.env.B1_GH_PATH || 'gh', args, { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; proc.kill(); }, timeoutMs);
    proc.stdout.on('data', c => { output += c; if (output.length > 300000) proc.kill(); });
    proc.stderr.on('data', c => { errors += c; if (errors.length > 100000) proc.kill(); });
    proc.on('error', err => { clearTimeout(timeout); reject(new Error(`gh spawn error: ${err.code || 'unknown'}`)); });
    proc.on('close', code => {
      clearTimeout(timeout);
      if (timedOut) return reject(new Error(`GitHub API timeout after ${timeoutMs}ms`));
      if (code !== 0) {
        // Never include raw stderr or tokens in a user-facing response or ledger.
        const status = errors.match(/HTTP (\d{3})/i)?.[1] || 'unknown';
        return reject(new Error(`GitHub API failed: exit=${code}, HTTP=${status}`));
      }
      try { resolve(JSON.parse(output)); } catch { reject(new Error('Invalid GitHub API JSON response')); }
    });
    proc.stdin.on('error', () => {});
    proc.stdin.end(body === null ? '' : JSON.stringify(body));
  });
}

function branchFor(jobId) { return `b1/gate-${jobId}`; }
function pullQuery(branch) { return `${prefix}/pulls?state=all&head=urieltisera%3A${encodeURIComponent(branch)}&base=main`; }

export async function probe(jobId) {
  const branch = branchFor(jobId);
  const prs = await ghApi(pullQuery(branch));
  const match = prs.find(p => p.head?.ref === branch && p.base?.ref === 'main');
  if (!match) return { verified: false, branch, reason: 'Draft PR not found (branch may still exist)' };
  const pr = await ghApi(`${prefix}/pulls/${match.number}`);
  const files = await ghApi(`${prefix}/pulls/${match.number}/files?per_page=100`);
  const includes = files.some(f => f.filename === 'b1-demo/proof.txt');
  return { verified: pr.draft === true && includes && pr.head?.ref === branch, branch, number: pr.number, url: pr.html_url, draft: pr.draft, fileConfirmed: includes };
}

async function stage(name, run) {
  try { return await run(); }
  catch (error) { throw new Error(`stage=${name}; ${error.message}`); }
}

export async function createDraftPr(job) {
  const { effect, id } = job;
  if (effect.repository !== REPO || effect.path !== 'b1-demo/proof.txt') throw Error('GitHub destination not authorized');
  // Read-only reconciliation before any remote mutation.
  const existing = await stage('preflight_probe', () => probe(id));
  if (existing.number) return existing;
  const branch = branchFor(id);
  const main = await stage('read_main', () => ghApi(`${prefix}/git/ref/heads/main`));
  const sha = main.object.sha;
  const parent = await stage('read_parent_commit', () => ghApi(`${prefix}/git/commits/${sha}`));
  const tree = await stage('create_tree', () => ghApi(`${prefix}/git/trees`, 'POST', {
    base_tree: parent.tree.sha,
    tree: [{ path: effect.path, mode: '100644', type: 'blob', content: effect.content }]
  }));
  const commit = await stage('create_commit', () => ghApi(`${prefix}/git/commits`, 'POST', {
    message: `B1 Gate approved effect ${job.effectHash}`,
    tree: tree.sha,
    parents: [sha]
  }));
  await stage('create_branch', () => ghApi(`${prefix}/git/refs`, 'POST', { ref: `refs/heads/${branch}`, sha: commit.sha }));
  await stage('create_pull_request', () => ghApi(`${prefix}/pulls`, 'POST', {
    title: effect.title, body: `${effect.body}\n\nB1 Gate approved effect SHA-256: ${job.effectHash}\nJob: ${id}`,
    head: branch, base: 'main', draft: true
  }));
  return stage('verify_pull_request', () => probe(id));
}
