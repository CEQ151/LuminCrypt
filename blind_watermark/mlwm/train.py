from __future__ import annotations

import argparse
import csv
import os
import random
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import yaml

from .attacks import apply_random_attack_chain
from .dataset import SyntheticPayloadImageDataset, attack_config_from_dict, build_fixed_residual_map
from .metrics import bit_accuracy, exact_match_rate
from .models import build_models, require_torch
from .traceability import build_run_manifest, git_snapshot, utc_now_iso, write_json


def load_config(path: str) -> dict[str, Any]:
  cfg_path = Path(path)
  data = yaml.safe_load(cfg_path.read_text(encoding='utf-8')) or {}
  parent = data.pop('extends', None)
  if parent:
    parent_path = Path(parent)
    if not parent_path.is_absolute():
      candidate = (cfg_path.parent / parent_path).resolve()
      parent_path = candidate if candidate.exists() else Path(parent).resolve()
    base = load_config(str(parent_path))
    return deep_update(base, data)
  return data


def deep_update(base: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
  out = dict(base)
  for key, value in updates.items():
    if isinstance(value, dict) and isinstance(out.get(key), dict):
      out[key] = deep_update(out[key], value)
    else:
      out[key] = value
  return out


def resolve_cli_overrides(config: dict[str, Any], args) -> dict[str, Any]:
  out = dict(config)
  if args.train_dir:
    out['train_dir'] = args.train_dir
  if args.val_dir:
    out['val_dir'] = args.val_dir
  if args.workdir:
    out['artifacts_dir'] = args.workdir
  if args.image_size:
    out['image_size'] = args.image_size
  if args.batch_size:
    out['batch_size'] = args.batch_size
  if args.grad_accum:
    out['grad_accum'] = args.grad_accum
  if args.device:
    out['device'] = args.device
  if args.amp:
    out['amp'] = True
  if args.epochs:
    out.setdefault('stages', {}).setdefault('main', {})['epochs'] = args.epochs
  return out


def torch_ssim(torch_mod, image_a, image_b):
  c1 = (0.01 ** 2)
  c2 = (0.03 ** 2)
  mu_a = torch_mod.nn.functional.avg_pool2d(image_a, 3, 1, 1)
  mu_b = torch_mod.nn.functional.avg_pool2d(image_b, 3, 1, 1)
  sigma_a = torch_mod.nn.functional.avg_pool2d(image_a * image_a, 3, 1, 1) - mu_a * mu_a
  sigma_b = torch_mod.nn.functional.avg_pool2d(image_b * image_b, 3, 1, 1) - mu_b * mu_b
  sigma_ab = torch_mod.nn.functional.avg_pool2d(image_a * image_b, 3, 1, 1) - mu_a * mu_b
  ssim_map = ((2 * mu_a * mu_b + c1) * (2 * sigma_ab + c2)) / (
    (mu_a * mu_a + mu_b * mu_b + c1) * (sigma_a + sigma_b + c2) + 1e-6
  )
  return ssim_map.mean()


def total_variation(torch_mod, image):
  return (
    torch_mod.abs(image[:, :, 1:, :] - image[:, :, :-1, :]).mean() +
    torch_mod.abs(image[:, :, :, 1:] - image[:, :, :, :-1]).mean()
  )


def attack_batch(torch_mod, watermarked, attack_cfg, stage_strength: str):
  attacked = []
  for sample in watermarked.detach().cpu().numpy():
    rgb = np.clip(np.round(sample.transpose(1, 2, 0) * 255.0), 0, 255).astype(np.uint8)
    attacked_rgb = apply_random_attack_chain(rgb, config=attack_cfg, strength=stage_strength)
    attacked_rgb = np.ascontiguousarray(attacked_rgb)
    attacked.append(torch_mod.from_numpy(attacked_rgb).permute(2, 0, 1).float() / 255.0)
  return torch_mod.stack(attacked, dim=0)


def save_checkpoint(path: Path, payload: dict[str, Any], torch_mod) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  torch_mod.save(payload, path)


def prepare_run_dir(config: dict[str, Any]) -> Path:
  git = git_snapshot()
  run_name = f"{utc_now_iso().replace(':', '').replace('+00:00', 'Z').replace('-', '')}_{git.get('shortCommit') or 'nogit'}"
  run_dir = Path(config.get('artifacts_dir', 'artifacts/mlwm_v1')) / 'runs' / run_name
  run_dir.mkdir(parents=True, exist_ok=True)
  return run_dir


def iter_enabled_stages(config: dict[str, Any], stage_filter: str | None = None):
  stage_order = ['warmup', 'main', 'hard_negative', 'finalize']
  stages = config.get('stages', {})
  for name in stage_order:
    stage_cfg = stages.get(name, {})
    if stage_filter and name != stage_filter:
      continue
    if stage_cfg.get('enabled', False):
      yield name, stage_cfg


def train_main(args) -> dict[str, Any]:
  torch, _, _ = require_torch()
  random.seed(20260426)
  np.random.seed(20260426)
  torch.manual_seed(20260426)
  if torch.cuda.is_available():
    torch.cuda.manual_seed_all(20260426)

  config = resolve_cli_overrides(load_config(args.config), args)
  run_dir = prepare_run_dir(config)
  Path(run_dir / 'stdout.log').touch()
  (run_dir / 'train_config_resolved.yaml').write_text(yaml.safe_dump(config, sort_keys=False), encoding='utf-8')

  train_dataset = SyntheticPayloadImageDataset(config['train_dir'], int(config.get('image_size', 512)))
  val_root = config.get('val_dir') or config['train_dir']
  val_dataset = SyntheticPayloadImageDataset(val_root, int(config.get('image_size', 512)))
  attack_cfg = attack_config_from_dict(config.get('attack', {}))

  train_loader = torch.utils.data.DataLoader(
    train_dataset,
    batch_size=int(config.get('batch_size', 4)),
    shuffle=True,
    num_workers=int(config.get('num_workers', 8)),
    pin_memory=torch.cuda.is_available(),
    drop_last=True,
  )
  val_loader = torch.utils.data.DataLoader(
    val_dataset,
    batch_size=int(config.get('batch_size', 4)),
    shuffle=False,
    num_workers=max(1, int(config.get('num_workers', 8)) // 2),
    pin_memory=torch.cuda.is_available(),
    drop_last=False,
  )

  device = torch.device(config.get('device', 'cuda') if torch.cuda.is_available() else 'cpu')
  encoder, decoder = build_models(payload_bits=256)
  encoder.to(device)
  decoder.to(device)
  optimizer = torch.optim.AdamW(
    list(encoder.parameters()) + list(decoder.parameters()),
    lr=float(config.get('optimizer', {}).get('lr', 2e-4)),
    weight_decay=float(config.get('optimizer', {}).get('weight_decay', 1e-5)),
  )
  scaler = torch.cuda.amp.GradScaler(enabled=bool(config.get('amp', True) and device.type == 'cuda'))
  bce = torch.nn.BCEWithLogitsLoss()
  mse = torch.nn.MSELoss()
  grad_accum = int(config.get('grad_accum', 4))
  loss_cfg = config.get('loss', {})
  metrics_path = run_dir / 'metrics_epoch.csv'
  best_score = -1.0
  best_epoch = -1
  best_ckpt_path = run_dir / 'best.ckpt'
  global_epoch = 0

  with metrics_path.open('w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['epoch', 'stage', 'train_loss', 'val_payload_acc', 'val_exact_match', 'val_confidence'])

    for stage_name, stage_cfg in iter_enabled_stages(config, args.stage):
      freeze_encoder = bool(stage_cfg.get('freeze_encoder', False))
      for parameter in encoder.parameters():
        parameter.requires_grad = not freeze_encoder
      stage_epochs = int(stage_cfg.get('epochs', 1))
      for _ in range(stage_epochs):
        global_epoch += 1
        encoder.train(not freeze_encoder)
        decoder.train()
        total_loss = 0.0
        optimizer.zero_grad(set_to_none=True)
        for batch_index, batch in enumerate(train_loader):
          clean = batch['image'].to(device)
          bits = batch['bits'].to(device)

          with torch.cuda.amp.autocast(enabled=scaler.is_enabled()):
            if freeze_encoder:
              residual = torch.stack(
                [build_fixed_residual_map(sample, clean.shape[-2], clean.shape[-1], float(stage_cfg.get('fixed_residual_scale', 0.02))).squeeze(0)
                 for sample in bits],
                dim=0,
              ).to(device)
            else:
              residual = encoder(clean, bits)

            watermarked = torch.clamp(clean + residual, 0.0, 1.0)
            attacked = attack_batch(torch, watermarked, attack_cfg, str(stage_cfg.get('attack_strength', 'medium'))).to(device)
            logits, confidence = decoder(attacked)
            payload_loss = bce(logits, bits)
            image_loss = mse(watermarked, clean) + 0.3 * (1.0 - torch_ssim(torch, watermarked, clean))
            residual_l2 = residual.pow(2).mean()
            residual_tv = total_variation(torch, residual)
            bit_correctness = ((logits.detach() >= 0) == (bits >= 0.5)).float().mean(dim=1, keepdim=True)
            confidence_loss = mse(torch.sigmoid(confidence), bit_correctness)
            loss = (
              float(loss_cfg.get('payload_weight', 5.0)) * payload_loss +
              float(loss_cfg.get('image_weight', 1.0)) * image_loss +
              float(loss_cfg.get('residual_weight', 0.1)) * residual_l2 +
              float(loss_cfg.get('tv_weight', 0.05)) * residual_tv +
              0.1 * confidence_loss
            ) / grad_accum

          scaler.scale(loss).backward()
          if (batch_index + 1) % grad_accum == 0:
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
          total_loss += float(loss.item()) * grad_accum

        encoder.eval()
        decoder.eval()
        val_payload_acc = 0.0
        val_exact = 0.0
        val_conf = 0.0
        val_batches = 0
        with torch.no_grad():
          for batch in val_loader:
            clean = batch['image'].to(device)
            bits = batch['bits'].to(device)
            residual = encoder(clean, bits) if not freeze_encoder else torch.stack(
              [build_fixed_residual_map(sample, clean.shape[-2], clean.shape[-1], float(stage_cfg.get('fixed_residual_scale', 0.02))).squeeze(0)
               for sample in bits],
              dim=0,
            ).to(device)
            watermarked = torch.clamp(clean + residual, 0.0, 1.0)
            attacked = attack_batch(torch, watermarked, attack_cfg, str(stage_cfg.get('attack_strength', 'medium'))).to(device)
            logits, confidence = decoder(attacked)
            val_payload_acc += bit_accuracy(logits.detach().cpu().numpy(), bits.detach().cpu().numpy())
            val_exact += exact_match_rate(logits.detach().cpu().numpy(), bits.detach().cpu().numpy())
            val_conf += float(torch.sigmoid(confidence).mean().item())
            val_batches += 1

        val_payload_acc /= max(val_batches, 1)
        val_exact /= max(val_batches, 1)
        val_conf /= max(val_batches, 1)
        writer.writerow([global_epoch, stage_name, total_loss / max(len(train_loader), 1), val_payload_acc, val_exact, val_conf])
        f.flush()

        score = val_payload_acc + val_exact
        if score > best_score:
          best_score = score
          best_epoch = global_epoch
          save_checkpoint(
            best_ckpt_path,
            {
              'encoder': encoder.state_dict(),
              'decoder': decoder.state_dict(),
              'config': config,
              'datasetManifestHash': train_dataset.manifest_hash,
              'bestMetric': score,
              'bestEpoch': best_epoch,
              'benchmarkSummary': {
                'valPayloadAcc': val_payload_acc,
                'valExactMatch': val_exact,
              },
            },
            torch,
          )

  manifest = build_run_manifest(
    repo_root=os.getcwd(),
    config=config,
    train_dir=config['train_dir'],
    val_dir=val_root,
    dataset_hash=train_dataset.manifest_hash,
    output_dir=str(run_dir),
    promoted=False,
    extra={
      'startTime': utc_now_iso(),
      'endTime': utc_now_iso(),
      'bestEpoch': best_epoch,
      'bestCheckpoint': str(best_ckpt_path),
      'bestScore': best_score,
    },
  )
  write_json(run_dir / 'run_manifest.json', manifest)
  return {
    'runDir': str(run_dir),
    'bestCheckpoint': str(best_ckpt_path),
    'bestEpoch': best_epoch,
    'bestScore': best_score,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description='Train MLWM v1')
  parser.add_argument('--config', required=True)
  parser.add_argument('--train-dir')
  parser.add_argument('--val-dir')
  parser.add_argument('--workdir')
  parser.add_argument('--image-size', type=int)
  parser.add_argument('--batch-size', type=int)
  parser.add_argument('--grad-accum', type=int)
  parser.add_argument('--epochs', type=int)
  parser.add_argument('--amp', action='store_true')
  parser.add_argument('--device')
  parser.add_argument('--stage', choices=['warmup', 'main', 'hard_negative', 'finalize'])
  args = parser.parse_args()
  result = train_main(args)
  print(yaml.safe_dump(result, sort_keys=False))


if __name__ == '__main__':
  main()
