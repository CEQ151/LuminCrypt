# Master Branch

`master` is the stable protected branch for LuminCrypt.

## Purpose

`master` should remain the reliable application baseline. It should not receive experimental ML training code, unbenchmarked models, or large generated artifacts directly.

## Current capabilities

- Unicode text detection and risk scoring
- Text watermark embedding and extraction
- Text cleaning and compare workflows
- Batch processing workflows
- Legacy robust image watermarking through the Python helper
- Electron + React desktop shell

## Current protection rules

The branch is protected by the repository ruleset `protect-master`.

Required behavior:

- Changes must enter through a pull request.
- Required status checks must pass:
  - `Test robust watermark engine`
  - `MLWM unit tests`
  - `Typecheck`
- Review conversations must be resolved before merging.
- Force pushes are blocked.
- Branch deletion is blocked.

Approval count is currently `0`, which keeps the repository usable as a single-owner project while still preventing direct pushes and failing-check merges.

## Merge readiness checklist

Before merging a PR into `master`:

- PR branch is current with `master`.
- Required checks are green.
- The PR description states validation commands or relevant CI runs.
- No raw datasets, intermediate checkpoints, temporary exports, or local virtual environments are included.
- Any promoted model artifact has an associated manifest, benchmark summary, and Git commit reference.

## MLWM visibility policy on master

Until a benchmarked neural model is promoted:

- `Legacy` remains the production image watermark engine.
- `Auto` may keep fallback behavior.
- `Neural` UI and diagnostics may remain visible, but must clearly report when the model is not ready.
- `neuralReady=false` must not be presented as a completed user-facing capability.

## Current relationship to `codex/mlwm-v1`

`codex/mlwm-v1` is the integration branch for MLWM v1. It should remain a draft PR branch until the first full model training, export, and benchmark pass are available.
