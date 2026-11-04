import test from 'node:test';
import assert from 'node:assert/strict';
import { Gate, effectHash } from '../src/core.js';
const effect = () => ({ action: 'github.create_draft_pr', repository: 'urieltisera/b1-gate2-demo', title: 'Test', body: 'Safe demo', path: 'b1-demo/proof.txt', content: 'approved file' });
test('approval required before execution', () => { const g = new Gate(); const j = g.propose(effect()); assert.throws(() => g.execute(j.id, j.effect), /Not approved/); });
test('approval bound to exact hash', () => { const g = new Gate(); const j = g.propose(effect()); assert.throws(() => g.approve(j.id, '0'.repeat(64)), /mismatch/); assert.equal(g.get(j.id).status, 'REQUIRE_APPROVAL'); });
test('mutation after approval rejected', () => { const g = new Gate(); const j = g.propose(effect()); g.approve(j.id, j.effectHash); assert.throws(() => g.execute(j.id, { ...j.effect, title: 'EVIL' }), /changed/); });
test('approved exact execution produces local simulated receipt', () => { const g = new Gate(); const j = g.propose(effect()); g.approve(j.id, j.effectHash); const done = g.execute(j.id, j.effect); assert.equal(done.status, 'VERIFIED_SIMULATION'); assert.equal(done.receipt.simulated, true); });
test('no duplicate execution', () => { const g = new Gate(); const j = g.propose(effect()); g.approve(j.id, j.effectHash); g.execute(j.id, j.effect); assert.throws(() => g.execute(j.id, j.effect), /Not approved/); });
test('ledger chain validates and detects tampering', () => { const g = new Gate(); g.propose(effect()); assert.equal(g.verifyLedger(), true); g.ledger[0].details.effectHash = 'tampered'; assert.equal(g.verifyLedger(), false); });
test('unauthorized repository is denied', () => { const g = new Gate(); assert.throws(() => g.propose({ ...effect(), repository: 'third-party/repo' }), /not allowed/); assert.equal(g.ledger[0].type, 'DENY'); });
test('canonical hashes are independent of key order', () => { assert.equal(effectHash({ a: 1, b: 2 }), effectHash({ b: 2, a: 1 })); });

test('signed ticket tampering rejected', () => { const g = new Gate(); const j = g.propose(effect()); g.approve(j.id, j.effectHash); g.jobs.get(j.id).ticket.signature = '0'.repeat(64); assert.throws(() => g.execute(j.id, j.effect), /signature/); });
test('operator approval code required when configured', () => { const g = new Gate({ approvalCode: 'secret' }); const j = g.propose(effect()); assert.throws(() => g.approve(j.id, j.effectHash, 'wrong'), /operator/); assert.equal(g.approve(j.id, j.effectHash, 'secret').status, 'APPROVED'); });
test('real execution begins only after approval and cannot begin twice', () => { const g = new Gate(); const j = g.propose(effect()); assert.throws(() => g.beginReal(j.id, j.effect), /Not approved/); g.approve(j.id, j.effectHash); assert.equal(g.beginReal(j.id, j.effect).status, 'EXECUTING'); assert.throws(() => g.beginReal(j.id, j.effect), /Not approved/); });
test('real mode unknown state is explicit', () => { const g = new Gate(); const j = g.propose(effect()); g.approve(j.id, j.effectHash); g.beginReal(j.id, j.effect); assert.equal(g.finishReal(j.id, { reason: 'timeout' }, false).status, 'EFFECT_UNKNOWN'); });
test('arbitrary remote paths are denied', () => { const g = new Gate(); assert.throws(() => g.propose({ ...effect(), path: '.github/workflows/evil.yml' }), /approved file/); });
