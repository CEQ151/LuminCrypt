# LuminCrypt Wiki

This wiki tracks the current repository branches, release posture, MLWM research work, and operational runbooks.

## Current branch map

| Branch | Role | Current status |
|---|---|---|
| `master` | Stable protected mainline | Production baseline for Unicode detection, text watermarking, and legacy image watermarking |
| `codex/mlwm-v1` | MLWM v1 research and integration branch | Draft PR branch for neural robust image watermarking; CI passing; training deferred until a suitable GPU window |

## Core pages

- [Master Branch](Master-Branch.md)
- [MLWM v1 Branch](MLWM-v1-Branch.md)
- [MLWM Training Runbook](MLWM-Training-Runbook.md)

## Governance snapshot

- Default branch: `master`
- Protection: active ruleset `protect-master`
- Required checks:
  - `Test robust watermark engine`
  - `MLWM unit tests`
  - `Typecheck`
- Merge policy: pull request required, conversations must be resolved, force push and branch deletion are blocked.

## Current priority

The next technical milestone is first full MLWM training on the prepared Unsplash Lite subset. Training is intentionally paused until there is enough uninterrupted local RTX 5060 time.
