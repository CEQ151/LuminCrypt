# MLWM Training Runbook

This runbook records the local training workflow for the neural robust image watermark engine.

## Environment

Training environment:

```powershell
py -3.12 -m venv .venv-ml
.\.venv-ml\Scripts\python.exe -m pip install --upgrade pip
.\.venv-ml\Scripts\python.exe -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
.\.venv-ml\Scripts\python.exe -m pip install -r blind_watermark\requirements-ml.txt
```

Runtime/package environment:

```powershell
py -3.12 -m venv .venv-pack
.\.venv-pack\Scripts\python.exe -m pip install --upgrade pip
.\.venv-pack\Scripts\python.exe -m pip install -r blind_watermark\requirements-onnx.txt pyinstaller
```

GPU verification:

```powershell
.\.venv-ml\Scripts\python.exe -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

Expected local result:

- CUDA available: `True`
- GPU: `NVIDIA GeForce RTX 5060 Laptop GPU`

## Unsplash Lite ingestion

The Unsplash Lite package at:

```text
C:\Users\Ha183\Downloads\Compressed\unsplash-research-dataset-lite-latest
```

contains metadata TSV/CSV files, not image files. Download resized images from `photos.csv000`:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.download_unsplash_lite --photos-file "C:\Users\Ha183\Downloads\Compressed\unsplash-research-dataset-lite-latest\photos.csv000" --out-dir data\unsplash_lite_raw --limit 5000 --width 1024 --quality 85 --workers 12
```

Current local download result:

- Requested: `5000`
- OK: `4999`
- Failed: `1`

## Dataset preparation

Prepare train/val directories:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.prepare_dataset --source data\unsplash_lite_raw --out-dir data --min-size 512 --val-ratio 0.1 --copy-mode hardlink --clean
```

Current local prepared dataset:

- Train: `4488`
- Validation: `499`
- Manifest: `data/dataset_manifest.json`

Use `--clean` to prevent older smoke samples from mixing into the current dataset.

## Smoke training

Run a short validation pass before long training:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.train --config configs\mlwm\smoke.yaml
```

Latest real-data smoke result:

- Run: `artifacts/mlwm_v1/runs/20260426T074520+0000_6056931`
- Best epoch: `2`
- Best score: `0.680125`

## Full training

Run only when the RTX 5060 can be occupied for several uninterrupted hours:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.train --config configs\mlwm\main.yaml
```

Monitor:

- GPU memory usage
- `metrics_epoch.csv`
- validation payload accuracy
- exact match rate
- checkpoint creation
- `run_manifest.json`

If GPU memory fails, reduce `image_size` to `448` for the first full experiment.

## Export

Export from the best checkpoint to a temporary candidate directory first:

```powershell
.\.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.export_onnx --config configs\mlwm\export.yaml --checkpoint <best.ckpt> --out-dir artifacts\mlwm_v1\tmp\candidate_001
```

Check runtime readiness:

```powershell
.\.venv-pack\Scripts\python.exe blind_watermark\bwm_helper.py --mode check --models-dir artifacts\mlwm_v1\tmp\candidate_001
```

Only copy ONNX files into `resources/models/neural_wm` after benchmark acceptance.

## Promotion checklist

A candidate model can be promoted only when:

- ONNX export succeeds as single-file `encoder.onnx` and `decoder.onnx`.
- Helper reports `neuralReady=true`.
- Benchmark results meet or clearly justify the acceptance threshold.
- `model.json` records:
  - model version
  - Git commit
  - dataset manifest hash
  - config hash
  - ONNX SHA-256 values
  - benchmark summary

Do not commit raw datasets, intermediate runs, or temporary exports.
