# B1 Gate — Governed Execution for AI Agents

**Intelligence is not authority.**

B1 Gate is a hackathon prototype that separates an AI agent's proposed action from the authority to execute that action. An untrusted proposal is checked against a deterministic policy, tied to a canonical effect hash, explicitly approved by a local human operator, and passed to a restricted executor. The result is checked against GitHub and recorded in a hash-linked in-memory event ledger.

Built for the **Meta Global AI Developer Hackathon 2026**, Indie Developer track.

## Why it matters

Agents can generate useful plans, but generating a plan should not grant permission to perform external side effects. B1 Gate demonstrates a narrow governance boundary for one concrete effect: proposing a Draft Pull Request in a designated GitHub test repository.

## Working demonstration

1. An operator submits a structured `github.create_draft_pr` proposal.
2. The policy gate checks the allowed repository and file path; the proposal enters `REQUIRE_APPROVAL`.
3. The UI displays the exact effect and its canonical SHA-256 hash.
4. The human operator reviews it and enters a local approval code. The approved effect is bound to a signed ticket (HMAC).
5. The executor validates the authorization and uses GitHub CLI to create a branch, commit and **Draft** Pull Request (without merging it).
6. The verifier queries GitHub and records the outcome, or uses `EFFECT_UNKNOWN` when a remote result cannot be established safely.

**Verified real-world proof:** [Draft PR #2 in the test repository](https://github.com/urieltisera/b1-gate2-demo/pull/2). It is a Draft PR against `main`, not a merged change. A separate read-back confirmed that its description contains the approved effect SHA-256 and that the remote file contents match the locally approved effect. The associated local job reached `VERIFIED_GITHUB`, with `ledgerValid: true`.

> The GitHub test repository is a target for demonstrating the governed effect; this repository contains the B1 Gate prototype itself.

## Architecture

```text
Structured proposal (untrusted input)
                 |
                 v
       Deterministic policy gate
       DENY / REQUIRE_APPROVAL
                 |
                 v
     Human review of exact effect
       + operator approval code
                 |
                 v
        Effect hash + HMAC ticket
                 |
                 v
         Controlled executor
          (GitHub CLI / API)
                 |
                 v
       GitHub read-back / verifier
                 |
                 v
       Hash-linked event ledger
```

## Local requirements

- Node.js (tested with Node.js 24 on Windows).
- GitHub CLI (`gh`) installed and authenticated for real GitHub execution.
- Access to the designated **test** repository for the real-effect demonstration.

No Python or third-party npm dependencies are required for the current prototype.

## Run locally

```powershell
npm test
npm start
```

Open `http://127.0.0.1:3030/`. By default, the executor operates in **simulation mode** and does not create remote changes.

To enable real GitHub execution **only in a controlled local environment**:

```powershell
$env:B1_REAL_EXECUTION = "1"
$env:B1_GH_PATH = "C:\Program Files\GitHub CLI\gh.exe" # adjust if different
npm start
```

The server prints a local operator approval code. **Never share or commit the code, GitHub tokens or authentication details.** Review the exact effect shown in the UI before approval. The code is a local demonstration mechanism, not production-grade identity or authorization.

The real executor targets `urieltisera/b1-gate2-demo` and the demonstration file `b1-demo/proof.txt`. Do not point this prototype at sensitive repositories or production resources.

## Tests

```powershell
npm test
```

At the demonstrated checkpoint, **13 automated tests passed**. They cover mandatory approval, exact-hash binding, rejection of mutated effects, duplicate-execution protection, unauthorized destinations and paths, canonical hashing, ticket tampering, operator-code checks, unknown remote results and ledger-chain verification. Automated local tests are not a substitute for a complete production security review.

## Failure handling and evidence

A successful external mutation is not inferred merely from a successful local command or an optimistic message. If a response is missing or uncertain, B1 Gate records `EFFECT_UNKNOWN`, preserving the need for read-only reconciliation before any retry. Earlier test attempts reached this state and were investigated without blindly repeating an effect.

The hash-linked ledger is **in memory**. Its validation detects modifications under its current trust assumptions but does not provide durable, independently anchored tamper-proof storage. Export evidence before shutting down the demo server.

## Scope and limitations

This is a **hackathon proof of concept**, not a production authorization service:

- Proposals are entered through a local form; **Meta Model API is not integrated** in this version.
- The local operator code is not authenticated user identity, role-based authorization or a hardened multi-user approval workflow.
- HMAC protects ticket integrity within this prototype's trust boundary; key custody and independent signing services are not implemented.
- The executor uses the local GitHub CLI login. Its account-level token may carry broader permissions than the effect allowlist; production use requires dedicated least-privilege credentials and hardened isolation.
- The event ledger and job state are held in memory, so they do not survive server restarts unless exported separately.
- The verifier demonstrates read-back checks for the concrete GitHub operation. This is not a general-purpose proof of arbitrary external effects.
- No claims of production-safe multi-tenant operation, durable replay protection or complete audit immutability are made.

## New work and attribution

This repository presents the B1 Gate local prototype implemented during the hackathon window (October 26–November 4, 2026). The narrow demonstration consists of the policy and approval flow, effect hashing, signed ticket, simulation/real execution modes, GitHub verification, event ledger and automated tests. External infrastructure and general prior project concepts are not claimed as hackathon-built deliverables.

## Demo link

- [Verified Draft PR #2 — external effect evidence](https://github.com/urieltisera/b1-gate2-demo/pull/2)

## Project philosophy

**An agent may propose. Authority must be granted. Effects must be verified.**
