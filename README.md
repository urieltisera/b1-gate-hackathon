# B1 Gate — Local MVP (reconstruction)

A new lightweight implementation intended to recover a demonstrable subset of B1 Gate when the original Contabo code is unavailable. Not the original project.

## Start

Requires Node.js >=20. No npm install required.

```sh
npm test
npm start
```

Open `http://127.0.0.1:3030`.

## Demonstrated
- Allowlist for action and target repository
- Explicit human approval bound to canonicalized SHA-256 effect hash
- Fail closed on mismatched approval, mutation, unauthorized repository, and repeat execution
- Append-only-in-process hash-linked event ledger and verification
- Browser UI with proposal, approval, simulation and evidence

## Explicit limitations
- Executor is **simulated**; this does NOT create a GitHub PR
- No Meta Model API / Muse integration
- No signed tickets, crash-safe persistence, cross-process replay protection, EFFECT_UNKNOWN reconciliation or external verifier
- In-process memory is lost on restart; not production security software
- `canonical` is a deterministic JSON key sort for this limited data shape, **not** full RFC 8785 JCS

Never include secrets in a public repository. Do not claim simulated behavior as production or remote execution.
