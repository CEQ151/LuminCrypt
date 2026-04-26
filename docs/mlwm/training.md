# MLWM v1 Training

## Recommended environment

- Python 3.12 x64
- NVIDIA GeForce RTX 5060 8GB
- CUDA-enabled PyTorch

## Install

```bash
py -3.12 -m venv .venv-ml
.venv-ml\Scripts\activate
python -m pip install --upgrade pip
python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
python -m pip install -r blind_watermark/requirements-ml.txt
```

For packaging/runtime checks:

```bash
py -3.12 -m venv .venv-pack
.venv-pack\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r blind_watermark/requirements-onnx.txt pyinstaller
```

Verify GPU availability:

```bash
.venv-ml\Scripts\python.exe -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))"
```

## Dataset

- Place natural images under `data/train_images`
- Validation images go under `data/val_images`
- No labels are required; payloads are generated synthetically per sample

Use the dataset preparation helper when importing images from one or more local
directories:

```bash
.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.prepare_dataset --source D:\images\natural --out-dir data --min-size 512 --val-ratio 0.1 --copy-mode copy
```

The helper filters unreadable or small images, de-duplicates by SHA-256, writes
`data/dataset_manifest.json`, and leaves raw datasets outside Git.

## Smoke run

```bash
.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.train --config configs/mlwm/smoke.yaml
```

## Main run

```bash
.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.train --config configs/mlwm/main.yaml
```

## Export

```bash
.venv-ml\Scripts\python.exe -m blind_watermark.mlwm.export_onnx --config configs/mlwm/export.yaml --checkpoint <path-to-best.ckpt>
```

Use `--out-dir artifacts/mlwm_v1/tmp/<name>` for smoke exports. Only write to
`resources/models/neural_wm` when promoting a benchmarked model.
