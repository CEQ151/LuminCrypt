from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np

from .dataset import SyntheticPayloadImageDataset, attack_config_from_dict
from .metrics import bit_accuracy, decode_success_rate, exact_match_rate
from .models import build_models, require_torch
from .train import attack_batch, load_config
from .traceability import utc_now_iso


def evaluate_checkpoint(args) -> dict[str, Any]:
  torch, _, _ = require_torch()
  config = load_config(args.config)
  val_root = args.val_dir or config.get('val_dir') or config['train_dir']
  dataset = SyntheticPayloadImageDataset(val_root, int(config.get('image_size', 512)))
  loader = torch.utils.data.DataLoader(
    dataset,
    batch_size=int(args.batch_size or config.get('batch_size', 4)),
    shuffle=False,
    num_workers=max(1, int(config.get('num_workers', 8)) // 2),
    pin_memory=torch.cuda.is_available(),
    drop_last=False,
  )
  device = torch.device(args.device or ('cuda' if torch.cuda.is_available() else 'cpu'))
  model_cfg = config.get('model', {})
  encoder, decoder = build_models(
    payload_bits=int(config.get('payload_bits', 256)),
    residual_scale=float(model_cfg.get('residual_scale', 8.0 / 255.0)),
  )
  checkpoint = torch.load(args.checkpoint, map_location=device, weights_only=False)
  encoder.load_state_dict(checkpoint['encoder'])
  decoder.load_state_dict(checkpoint['decoder'])
  encoder.to(device).eval()
  decoder.to(device).eval()
  attack_cfg = attack_config_from_dict(config.get('attack', {}))

  payload_acc = 0.0
  exact = 0.0
  decode = 0.0
  batches = 0
  samples = 0
  repeats = max(1, int(args.repeats))
  with torch.no_grad():
    for _ in range(repeats):
      for batch_index, batch in enumerate(loader):
        if args.max_batches and batch_index >= args.max_batches:
          break
        clean = batch['image'].to(device)
        bits = batch['bits'].to(device)
        residual = encoder(clean, bits)
        watermarked = torch.clamp(clean + residual, 0.0, 1.0)
        attacked = attack_batch(torch, watermarked, attack_cfg, args.strength).to(device)
        logits, _ = decoder(attacked)
        logits_np = logits.detach().cpu().numpy()
        bits_np = bits.detach().cpu().numpy()
        payload_acc += bit_accuracy(logits_np, bits_np)
        exact += exact_match_rate(logits_np, bits_np)
        decode += decode_success_rate(logits_np, list(batch['text']))
        batches += 1
        samples += int(clean.shape[0])

  result = {
    'checkpoint': str(args.checkpoint),
    'config': str(args.config),
    'valDir': str(val_root),
    'strength': args.strength,
    'repeats': repeats,
    'batches': batches,
    'samples': samples,
    'payloadAcc': payload_acc / max(batches, 1),
    'exactMatch': exact / max(batches, 1),
    'decodeSuccess': decode / max(batches, 1),
    'createdAt': utc_now_iso(),
  }
  if args.out:
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description='Evaluate an MLWM checkpoint')
  parser.add_argument('--config', required=True)
  parser.add_argument('--checkpoint', required=True)
  parser.add_argument('--val-dir')
  parser.add_argument('--strength', default='medium')
  parser.add_argument('--repeats', type=int, default=3)
  parser.add_argument('--max-batches', type=int)
  parser.add_argument('--batch-size', type=int)
  parser.add_argument('--device')
  parser.add_argument('--out')
  args = parser.parse_args()
  print(json.dumps(evaluate_checkpoint(args), ensure_ascii=False, indent=2))


if __name__ == '__main__':
  main()
