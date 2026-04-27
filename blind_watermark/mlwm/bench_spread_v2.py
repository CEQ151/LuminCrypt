from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import time
from pathlib import Path
from typing import Any

import cv2

from .metrics import psnr, ssim
from .spread_v2 import decode_bgr, embed_bgr, fingerprint_hex


def _jpeg_roundtrip(image, quality: int):
  ok, buf = cv2.imencode('.jpg', image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
  if not ok:
    raise ValueError('JPEG encode failed')
  return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def _attacks(image) -> dict[str, Any]:
  h, w = image.shape[:2]
  attacks = {
    'clean': image,
    'png_roundtrip': cv2.imdecode(cv2.imencode('.png', image)[1], cv2.IMREAD_COLOR),
  }
  for quality in [95, 90, 85, 80, 75]:
    attacks[f'jpeg{quality}'] = _jpeg_roundtrip(image, quality)
  for scale in [0.75, 0.5]:
    small = cv2.resize(image, (max(1, int(w * scale)), max(1, int(h * scale))), interpolation=cv2.INTER_AREA)
    attacks[f'resize{scale:g}'] = cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
  attacks['mild_blur'] = cv2.GaussianBlur(image, (3, 3), 0.55)
  crop = image[int(h * 0.05):int(h * 0.95), int(w * 0.05):int(w * 0.95)]
  attacks['crop90'] = cv2.resize(crop, (w, h), interpolation=cv2.INTER_CUBIC)
  return attacks


def _image_paths(inputs: list[str]) -> list[str]:
  paths: list[str] = []
  for item in inputs:
    p = Path(item)
    if p.is_dir():
      for ext in ('*.png', '*.jpg', '*.jpeg', '*.bmp', '*.tif', '*.tiff'):
        paths.extend(glob.glob(str(p / ext)))
    else:
      paths.extend(glob.glob(item))
  return sorted(set(paths))


def run(args: argparse.Namespace) -> dict[str, Any]:
  out_dir = Path(args.out_dir)
  out_dir.mkdir(parents=True, exist_ok=True)
  rows = []
  started = time.time()
  for path in _image_paths(args.inputs):
    image = cv2.imread(path, cv2.IMREAD_COLOR)
    if image is None:
      continue
    for profile in args.profiles:
      expected_fp = fingerprint_hex(args.text, args.password)
      try:
        watermarked, diagnostics = embed_bgr(
          image,
          args.text,
          args.password,
          profile,
          payload_mode=args.payload_mode,
        )
        quality_psnr = psnr(image, watermarked)
        quality_ssim = ssim(image, watermarked)
      except Exception as exc:
        rows.append({
          'image': path,
          'profile': profile,
          'attack': 'embed',
          'ok': False,
          'error': str(exc),
        })
        continue

      for attack_name, attacked in _attacks(watermarked).items():
        row = {
          'image': path,
          'profile': profile,
          'payloadMode': args.payload_mode,
          'fingerprint': diagnostics.get('fingerprint'),
          'attack': attack_name,
          'psnr': quality_psnr,
          'ssim': quality_ssim,
          'ok': False,
          'confidence': None,
          'berEstimate': None,
          'decoded': '',
          'error': '',
        }
        try:
          decoded = decode_bgr(attacked, args.password, profile, payload_mode=args.payload_mode)
          row['decoded'] = decoded.get('text', '')
          row['confidence'] = decoded.get('confidence')
          row['berEstimate'] = decoded.get('berEstimate')
          row['ok'] = (
            row['decoded'] == f'fp:{expected_fp}'
            if args.payload_mode == 'fingerprint64'
            else row['decoded'] == args.text
          )
        except Exception as exc:
          row['error'] = str(exc)
        rows.append(row)

      fpr_row = {
        'image': path,
        'profile': profile,
        'payloadMode': args.payload_mode,
        'fingerprint': diagnostics.get('fingerprint'),
        'attack': 'original_fpr',
        'psnr': quality_psnr,
        'ssim': quality_ssim,
        'ok': False,
        'confidence': None,
        'berEstimate': None,
        'decoded': '',
        'error': '',
      }
      try:
        decoded = decode_bgr(image, args.password, profile, payload_mode=args.payload_mode)
        fpr_row['decoded'] = decoded.get('text', '')
        fpr_row['confidence'] = decoded.get('confidence')
        fpr_row['ok'] = True
      except Exception as exc:
        fpr_row['error'] = str(exc)
      rows.append(fpr_row)

  csv_path = out_dir / 'spread_v2_bench.csv'
  json_path = out_dir / 'spread_v2_bench.json'
  fields = sorted({key for row in rows for key in row.keys()})
  with csv_path.open('w', newline='', encoding='utf-8') as fh:
    writer = csv.DictWriter(fh, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
  summary = {
    'createdAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'elapsedSec': round(time.time() - started, 3),
    'rows': len(rows),
    'csv': str(csv_path),
    'profiles': args.profiles,
    'payloadMode': args.payload_mode,
    'successByAttack': {},
  }
  for attack in sorted({row.get('attack') for row in rows}):
    subset = [row for row in rows if row.get('attack') == attack]
    summary['successByAttack'][attack] = {
      'ok': sum(1 for row in subset if row.get('ok') is True),
      'total': len(subset),
    }
  json_path.write_text(json.dumps({'summary': summary, 'rows': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
  summary['json'] = str(json_path)
  return summary


def main() -> None:
  parser = argparse.ArgumentParser(description='Benchmark frequency-spread-v2 image watermarking.')
  parser.add_argument('inputs', nargs='*', default=['data/train_images', 'data/val_images'])
  parser.add_argument('--out-dir', default='artifacts/spread_v2_eval')
  parser.add_argument('--profiles', nargs='+', default=['trace', 'faint', 'light', 'balanced'])
  parser.add_argument('--payload-mode', choices=['fingerprint64', 'text16'], default='fingerprint64')
  parser.add_argument('--text', default='LuminCrypt spread v2 benchmark payload')
  parser.add_argument('--password', type=int, default=123)
  print(json.dumps(run(parser.parse_args()), ensure_ascii=False, indent=2))


if __name__ == '__main__':
  main()
