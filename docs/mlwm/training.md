# MLWM v1 Training

## Recommended environment

- Python 3.12 x64
- NVIDIA GeForce RTX 5060 8GB
- CUDA-enabled PyTorch

## Install

```bash
python -m venv .venv-ml
.venv-ml\\Scripts\\activate
pip install -r blind_watermark/requirements-ml.txt
```

## Dataset

- Place natural images under `data/train_images`
- Validation images go under `data/val_images`
- No labels are required; payloads are generated synthetically per sample

## Smoke run

```bash
python -m blind_watermark.mlwm.train --config configs/mlwm/smoke.yaml
```

## Main run

```bash
python -m blind_watermark.mlwm.train --config configs/mlwm/main.yaml
```

## Export

```bash
python -m blind_watermark.mlwm.export_onnx --config configs/mlwm/export.yaml --checkpoint <path-to-best.ckpt>
```
