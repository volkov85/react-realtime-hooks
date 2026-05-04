# Security Policy

Thank you for taking the time to report a security issue in
`react-realtime-hooks`. This document describes which versions are eligible
for security fixes and how to report a vulnerability privately.

## Supported Versions

Security fixes are backported only to the current major release line. Older
major versions are out of scope for security maintenance.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |
| < 1.0   | :x:                |

If you are running an unsupported version, the recommended remediation is to
upgrade to the current major. See [`MIGRATING.md`](./MIGRATING.md) for the
1.x → 2.x migration steps.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.** Public
issues will be visible to everyone and may give attackers a head start.

Use GitHub's private vulnerability reporting instead:

1. Go to the repository's
   [Security tab](https://github.com/volkov85/react-realtime-hooks/security).
2. Click **Report a vulnerability** and fill in the form.

If GitHub's private reporting is unavailable, you can email the maintainer
directly via the address listed in the
[`package.json`](./package.json) `author` field. Please include:

- a clear description of the issue, including the affected hook(s) and
  version,
- steps to reproduce, ideally as a minimal code sample,
- any known impact (data exfiltration, crash, hang, etc.),
- whether you have already disclosed this to anyone else.

## Response Expectations

Maintenance is best-effort and the project is not run by a dedicated
security team. Realistic expectations:

- **Acknowledgement:** within 5 business days.
- **Triage and severity assessment:** within 14 business days.
- **Fix or mitigation plan:** depends on severity and complexity. Critical
  issues are prioritised; lower-severity issues may be batched into a normal
  release.

You will be credited in the release notes unless you ask to remain
anonymous. Please give the maintainer reasonable time to issue a fix before
disclosing publicly. The standard window is **90 days** from the
acknowledgement date.

## Threat Model and Scope

`react-realtime-hooks` is a thin wrapper around the browser's native
`WebSocket` and `EventSource` APIs plus a few timer-driven helpers. The
package itself has **zero runtime dependencies** and runs entirely in the
consumer's React tree. Items in scope:

- Issues in the public hook API (`useWebSocket`, `useEventSource`,
  `useReconnect`, `useHeartbeat`, `useOnlineStatus`, `usePageVisibility`,
  `useConnectionGate`).
- Issues in the published artefact (`dist/index.js`, `dist/index.cjs`,
  `dist/index.d.ts`, `dist/index.d.cts`).
- Type-system bypasses that allow unsafe runtime states.
- Build-pipeline issues that could ship malicious code to npm
  (e.g. supply-chain compromise of the publish workflow).

Out of scope:

- Vulnerabilities in `react`, the browser's own transport implementations,
  or any third-party server you connect to.
- Issues only reproducible by passing intentionally malicious option
  callbacks (`onOpen`, `onMessage`, etc.) — those run consumer-supplied
  code, which is the consumer's responsibility.
- Reports against the demo (`demo/`) that do not affect the library
  artefact.
