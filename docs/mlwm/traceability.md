# MLWM v1 Traceability Rules

## Branching

- Do not develop directly on `master`
- Use feature branches for MLWM changes
- Merge feature branches into the MLWM integration branch before merging to `master`

## Commits

- Keep commits single-topic and atomic
- Use conventional prefixes such as `feat(mlwm)`, `feat(ui)`, `docs(mlwm)`, `test(mlwm)`

## Run manifests

Every training run writes a `run_manifest.json` with:

- git branch
- git commit SHA
- dirty flag
- Python version
- CUDA version
- GPU name
- config hash
- dataset manifest hash
- timing data
- model digests

## Git tracking rules

Tracked in Git:

- source code
- docs
- configs
- promoted model manifests
- benchmark summaries

Tracked through Git LFS:

- promoted ONNX files
- promoted checkpoints

Ignored:

- raw datasets
- intermediate checkpoints
- temporary exports
- tensorboard logs
- large per-run artifacts outside promoted releases
