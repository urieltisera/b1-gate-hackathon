# B1 Gate v0.2 — Hackathon prototype

Governed GitHub Draft PR demo. Requires Node 20+ and GitHub CLI (`gh`) for **real mode**. No Python or npm dependencies.

## Default mode: simulation

`npm test` (13 automated tests) then `npm start`. Open `http://127.0.0.1:3030/`.

Approval code appears in the **local server terminal**; do not share it. Review the exact effect, especially `b1-demo/proof.txt`, before approving.

## Real mode (writes to GitHub)

**Only on a trusted local PC after `gh auth login`:** stop the server (Ctrl+C), then in PowerShell run `$env:B1_REAL_EXECUTION='1'; npm start`. Avoid visiting untrusted sites while running the server; only loopback binding is used, but this prototype does not provide production-grade CSRF/origin controls.

Mode REAL_GITHUB creates a new branch and Draft PR in **only** `urieltisera/b1-gate2-demo`; never merges or edits `main`. GitHub CLI uses the existing user credential, which may be broader than ideal. Restrict credentials for production.

Approval requires the server-terminal operator code plus the exact effect hash. Tickets are HMAC-signed in memory. The server moves to EXECUTING before network writes; on ambiguous error it records EFFECT_UNKNOWN and exposes **read-only** reconciliation. Never blindly repeat a failed remote write. The verifier checks the Draft PR and expected filename; it does not yet cryptographically verify remote content bytes. Ledger is memory-only and resets on restart. This is a hackathon prototype, not a hardened authority boundary.

## Limitations

Agent proposals are manual; Meta Model API not yet integrated. The server has no persistent job storage and no production authentication, robust origin protection, or token broker. Do not expose to the Internet.
