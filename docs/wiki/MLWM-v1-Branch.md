# MLWM v1 Branch

`codex/mlwm-v1` is the active neural image watermarking research and integration branch.

## Purpose

This branch adds a learning-assisted robust image watermark engine next to the existing legacy DCT/Reed-Solomon image watermark engine.

The branch should stay separate from `master` until a first trained model can be exported and benchmarked.

## Current implementation status

Implemented:

- `engine='auto' | 'legacy' | 'neural'` dispatch in the Python watermark engine
- Structured Python return values with:
  - `engine_used`
  - `fallback_used`
  - `confidence`
  - `diagnostics`
- Electron IPC and preload type support for image watermark engine selection
- Renderer UI for `Auto`, `Legacy`, and `Neural`
- MLWM modules for:
  - payload codec
  - attack simulation
  - dataset loading
  - model definitions
  - training
  - ONNX export
  - runtime inference
  - benchmarking
  - traceability
- GitHub Actions checks:
  - `Test robust watermark engine`
  - `MLWM unit tests`
  - `Typecheck`
- Dataset preparation tooling
- Unsplash Lite metadata downloader

Not completed:

- Full main training run
- Promoted `encoder.onnx` and `decoder.onnx`
- Benchmark report against the release thresholds
- `resources/models/neural_wm/model.json` promotion from `pending-training`

## Local environment status

Validated locally:

- Python 3.12 virtual environments:
  - `.venv-ml`
  - `.venv-pack`
- PyTorch CUDA:
  - `torch 2.11.0+cu128`
  - GPU detected: `NVIDIA GeForce RTX 5060 Laptop GPU`
- ONNX Runtime:
  - `onnxruntime 1.25.0`
- Smoke training completed on prepared Unsplash Lite data.
- Temporary single-file ONNX export completed.
- Helper check can report `neuralReady=true` when pointed at a temporary exported model directory.

## Prepared data status

The current local training data was prepared from Unsplash Lite metadata.

Downloaded:

- Requested: `5000`
- Successful: `4999`
- Failed: `1`

Prepared dataset:

- `data/train_images`: `4488`
- `data/val_images`: `499`
- Manifest: `data/dataset_manifest.json`

The `data/` directory is intentionally ignored by Git.

## Smoke training result

Latest real-data smoke run:

- Run directory: `artifacts/mlwm_v1/runs/20260426T074520+0000_6056931`
- Best checkpoint: `best.ckpt`
- Best epoch: `2`
- Best score: `0.680125`
- Validation payload accuracy: about `0.680`
- Exact match: `0.0`

This confirms the training pipeline is operational. It is not a usable production model.

## Next milestone

Run the first full training pass when the local GPU can be occupied for several hours:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.train --config configs\mlwm\main.yaml
```

After training:

1. Export the best checkpoint to a temporary candidate directory.
2. Run benchmark evaluation.
3. Promote the model only if it meets the release thresholds.
4. Update `resources/models/neural_wm/model.json` with hashes, commit, dataset manifest hash, and benchmark summary.
5. Keep PR #1 as draft until the model promotion decision is clear.
