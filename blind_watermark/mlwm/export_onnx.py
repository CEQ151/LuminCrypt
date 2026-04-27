from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

from .codec import PAYLOAD_BITS
from .infer import probe_runtime
from .models import build_models, require_torch
from .traceability import config_hash, git_snapshot, sha256_file, stable_json_dumps, utc_now_iso, write_json


def configure_console_encoding() -> None:
  for stream_name in ('stdout', 'stderr'):
    stream = getattr(sys, stream_name, None)
    if hasattr(stream, 'reconfigure'):
      stream.reconfigure(encoding='utf-8', errors='replace')


def load_config(path: str) -> dict[str, Any]:
  cfg_path = Path(path)
  data = yaml.safe_load(cfg_path.read_text(encoding='utf-8')) or {}
  parent = data.pop('extends', None)
  if parent:
    parent_path = Path(parent)
    if not parent_path.is_absolute():
      candidate = (cfg_path.parent / parent_path).resolve()
      parent_path = candidate if candidate.exists() else Path(parent).resolve()
    parent_data = load_config(str(parent_path))
    parent_data.update(data)
    return parent_data
  return data


def export_models(config: dict[str, Any], checkpoint_path: str, out_dir: str | None = None) -> dict[str, Any]:
  torch, _, _ = require_torch()
  ckpt = torch.load(checkpoint_path, map_location='cpu')
  model_cfg = config.get('model', {})
  encoder, decoder = build_models(
    payload_bits=PAYLOAD_BITS,
    residual_scale=float(model_cfg.get('residual_scale', 8.0 / 255.0)),
  )
  encoder.load_state_dict(ckpt['encoder'])
  decoder.load_state_dict(ckpt['decoder'])
  encoder.eval()
  decoder.eval()

  models_dir = Path(out_dir or config.get('models_dir', 'resources/models/neural_wm'))
  models_dir.mkdir(parents=True, exist_ok=True)
  encoder_path = models_dir / 'encoder.onnx'
  decoder_path = models_dir / 'decoder.onnx'

  dummy_image = torch.randn(1, 3, int(config.get('image_size', 512)), int(config.get('image_size', 512)))
  dummy_bits = torch.randint(0, 2, (1, PAYLOAD_BITS)).float()

  torch.onnx.export(
    encoder,
    (dummy_image, dummy_bits),
    str(encoder_path),
    input_names=['image', 'payload_bits'],
    output_names=['residual'],
    dynamic_axes=None,
    opset_version=int(config.get('export', {}).get('opset', 18)),
    external_data=False,
  )
  torch.onnx.export(
    decoder,
    dummy_image,
    str(decoder_path),
    input_names=['image'],
    output_names=['payload_logits', 'confidence'],
    dynamic_axes=None,
    opset_version=int(config.get('export', {}).get('opset', 18)),
    external_data=False,
  )

  manifest = {
    'modelVersion': 'mlwm-v1-export',
    'status': 'ready',
    'engine': 'neural',
    'trainingConfigId': config_hash(config),
    'datasetManifestHash': ckpt.get('datasetManifestHash'),
    'exportTime': utc_now_iso(),
    'gitCommit': git_snapshot().get('commit'),
    'checkpoint': {
      'path': str(checkpoint_path),
      'sha256': sha256_file(checkpoint_path),
      'bestEpoch': ckpt.get('bestEpoch'),
      'bestMetric': ckpt.get('bestMetric'),
    },
    'encoder': {
      'path': encoder_path.name,
      'sha256': sha256_file(encoder_path),
    },
    'decoder': {
      'path': decoder_path.name,
      'sha256': sha256_file(decoder_path),
    },
    'benchmarkSummary': ckpt.get('benchmarkSummary', {}),
  }
  write_json(models_dir / 'model.json', manifest)
  return {
    'encoder': str(encoder_path),
    'decoder': str(decoder_path),
    'manifest': manifest,
    'runtimeStatus': probe_runtime(str(models_dir)).ready,
  }


def main() -> None:
  configure_console_encoding()
  parser = argparse.ArgumentParser(description='Export MLWM v1 models to ONNX')
  parser.add_argument('--config', required=True)
  parser.add_argument('--checkpoint', required=True)
  parser.add_argument('--out-dir')
  args = parser.parse_args()

  config = load_config(args.config)
  result = export_models(config, args.checkpoint, args.out_dir)
  print(stable_json_dumps(result))


if __name__ == '__main__':
  main()
