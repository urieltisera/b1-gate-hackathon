import test from 'node:test';
import assert from 'node:assert/strict';
import { effectFromModel, museProposal } from '../src/meta.js';
import { Gate } from '../src/core.js';

test('Muse proposal cannot select arbitrary repo, path or action', () => {
  const proposal = effectFromModel({ title: 'Safe proof', body: 'Demo', content: 'Approved only by humans.' });
  assert.equal(proposal.repository, 'urieltisera/b1-gate2-demo');
  assert.equal(proposal.path, 'b1-demo/proof.txt');
  assert.equal(proposal.action, 'github.create_draft_pr');
});
test('Unexpected fields and oversized content fail closed', () => {
  assert.throws(() => effectFromModel({ title: 'a', body: '', content: 'x', repository: 'other/repo' }));
  assert.throws(() => effectFromModel({ title: 'a', body: '', content: 'x'.repeat(2001) }));
});
test('Model proposal requires independent human approval', () => {
  const gate = new Gate({ approvalCode: 'demo-operator-code' });
  const job = gate.propose(effectFromModel({ title: 'Safe', body: 'Demo', content: 'Hello' }));
  assert.equal(job.status, 'REQUIRE_APPROVAL');
  assert.throws(() => gate.beginReal(job.id, job.effect), /Not approved/);
});
test('Meta adapter accepts structured output without execution', async () => {
  let called = 0;
  const fetchImpl = async (_url, options) => {
    called++;
    assert.equal(options.method, 'POST');
    assert.equal(JSON.parse(options.body).model, 'muse-spark-1.3');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Proof', body: 'Demo', content: 'Meta proposed this.' }) } }] }) };
  };
  const effect = await museProposal('Create a harmless governance proof', { key: 'dummy-test-key', fetchImpl });
  assert.equal(called, 1);
  assert.equal(effect.content, 'Meta proposed this.');
  assert.equal(effect.repository, 'urieltisera/b1-gate2-demo');
});
test('No key means no API call', async () => {
  await assert.rejects(museProposal('create a proposal', { key: '', fetchImpl: () => { throw Error('must not call'); } }), /MODEL_API_KEY/);
});
