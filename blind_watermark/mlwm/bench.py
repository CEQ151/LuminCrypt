from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from .attacks import AttackConfig, attack_corner_overlay, attack_crop, attack_gaussian_blur, attack_gaussian_noise, attack_jpeg, attack_resize, attack_rotate, attack_screenshot_sim, attack_webp
from .dataset import discover_images, load_rgb_image


def build_attack_suite(cfg: AttackConfig):
  return {
    'clean': lambda image: image,
    'jpeg_q75': lambda image: attack_jpeg(image, AttackConfig(jpeg_quality=(75, 75)), __import__('random').Random(1)),
    'jpeg_q50': lambda image: attack_jpeg(image, AttackConfig(jpeg_quality=(50, 50)), __import__('random').Random(2)),
    'webp_q50': lambda image: attack_webp(image, AttackConfig(webp_quality=(50, 50)), __import__('random').Random(3)),
    'resize_half': lambda image: attack_resize(image, AttackConfig(resize_scale=(0.5, 0.5)), __import__('random').Random(4)),
    'crop_10pct': lambda image: attack_crop(image, AttackConfig(crop_keep=(0.9, 0.9)), __import__('random').Random(5)),
    'rotation3_jpeg75': lambda image: attack_jpeg(attack_rotate(image, AttackConfig(rotation_deg=(3.0, 3.0)), __import__('random').Random(6)), AttackConfig(jpeg_quality=(75, 75)), __import__('random').Random(7)),
    'blur_noise': lambda image: attack_gaussian_noise(attack_gaussian_blur(image, cfg, __import__('random').Random(8)), cfg, __import__('random').Random(9)),
    'corner_overlay': lambda image: attack_corner_overlay(image, cfg, __import__('random').Random(10)),
    'screenshot_sim': lambda image: attack_screenshot_sim(image, cfg, __import__('random').Random(11)),
  }


def bench_engine(engine: str, paths: list[str], text: str, quality: str, password: int) -> dict:
  from blind_watermark.rwm_engine import embed_watermark, extract_watermark

  cfg = AttackConfig()
  suite = build_attack_suite(cfg)
  cases = {name: {'success': 0, 'total': 0} for name in suite}

  for path in paths:
    rgb = load_rgb_image(path)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    embedded = embed_watermark(bgr, text, password=password, quality=quality, engine=engine)
    if not embedded.get('ok'):
      return {'engine': engine, 'ok': False, 'error': embedded.get('error')}
    wm_image = embedded['image']
    for name, attack_fn in suite.items():
      attacked_rgb = attack_fn(cv2.cvtColor(wm_image, cv2.COLOR_BGR2RGB))
      attacked_bgr = cv2.cvtColor(attacked_rgb, cv2.COLOR_RGB2BGR)
      extracted = extract_watermark(attacked_bgr, password=password, engine=engine, quality=quality)
      cases[name]['total'] += 1
      if extracted.get('ok') and extracted.get('wm') == text:
        cases[name]['success'] += 1

  summary = {
    name: (data['success'] / data['total'] if data['total'] else 0.0)
    for name, data in cases.items()
  }
  return {'engine': engine, 'ok': True, 'summary': summary}


def main() -> None:
  parser = argparse.ArgumentParser(description='Benchmark MLWM and legacy engines')
  parser.add_argument('--input-dir', required=True)
  parser.add_argument('--output', default='artifacts/mlwm_v1/benchmark.json')
  parser.add_argument('--text', default='TRACE-MLWM-V1')
  parser.add_argument('--quality', default='balanced')
  parser.add_argument('--password', type=int, default=1)
  parser.add_argument('--limit', type=int, default=8)
  args = parser.parse_args()

  paths = discover_images(args.input_dir)[:args.limit]
  if not paths:
    raise ValueError(f'no benchmark images found under {args.input_dir}')

  payload = {
    'legacy': bench_engine('legacy', paths, args.text, args.quality, args.password),
    'neural': bench_engine('neural', paths, args.text, args.quality, args.password),
    'auto': bench_engine('auto', paths, args.text, args.quality, args.password),
  }
  out_path = Path(args.output)
  out_path.parent.mkdir(parents=True, exist_ok=True)
  out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
  print(json.dumps(payload, ensure_ascii=False))


if __name__ == '__main__':
  main()
