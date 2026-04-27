#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bwm_helper.py - CLI bridge between Electron and the image watermark engines.

The helper prints exactly one JSON object to stdout.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import traceback

import numpy as np


if sys.stdout.encoding and sys.stdout.encoding.upper() not in ('UTF-8', 'UTF8'):
  sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)
if sys.stderr.encoding and sys.stderr.encoding.upper() not in ('UTF-8', 'UTF8'):
  sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPT_DIR not in sys.path:
  sys.path.insert(0, _SCRIPT_DIR)


def imread_unicode(path, flags=None):
  import cv2
  if flags is None:
    flags = cv2.IMREAD_UNCHANGED
  buffer = np.fromfile(path, dtype=np.uint8)
  return cv2.imdecode(buffer, flags)


def imwrite_unicode(path, img, params=None):
  import cv2
  ext = os.path.splitext(path)[1]
  ok, buffer = cv2.imencode(ext, img, params or [])
  if ok:
    buffer.tofile(path)
  return ok


def _apply_models_dir(args) -> None:
  models_dir = getattr(args, 'models_dir', '')
  if models_dir:
    os.environ['LUMINCRYPT_MLWM_MODELS_DIR'] = models_dir


def cmd_check(args):
  try:
    _apply_models_dir(args)
    from rwm_engine import check_dependencies

    result = check_dependencies()
    if not result.get('ok'):
      result['error'] = (
        f"Missing dependencies: {', '.join(result.get('missing', []))}. "
        f"Run: pip install {' '.join(result.get('missing', []))}"
      )
    print(json.dumps(result), flush=True)
  except ImportError as exc:
    print(json.dumps({'ok': False, 'error': str(exc)}), flush=True)


def cmd_embed(args):
  if not args.output:
    print(json.dumps({'ok': False, 'error': '--output is required for embed mode'}), flush=True)
    return
  if not args.wm:
    print(json.dumps({'ok': False, 'error': '--wm is required for embed mode'}), flush=True)
    return
  if not os.path.isfile(args.input):
    print(json.dumps({'ok': False, 'error': f'Input file not found: {args.input}'}), flush=True)
    return

  try:
    _apply_models_dir(args)
    from rwm_engine import embed_watermark
  except ImportError as exc:
    print(json.dumps({
      'ok': False,
      'error': f'Cannot import dependencies: {exc}. Run: pip install -r blind_watermark/requirements.txt',
    }), flush=True)
    return

  try:
    image = imread_unicode(args.input)
    if image is None:
      print(json.dumps({'ok': False, 'error': f'Cannot read image: {args.input}'}), flush=True)
      return

    result = embed_watermark(
      img=image,
      text=args.wm,
      password=args.password,
      quality=args.quality,
      engine=args.engine,
      models_dir=args.models_dir or None,
      self_check=getattr(args, 'self_check', True),
    )
    if not result.get('ok'):
      print(json.dumps(result), flush=True)
      return

    imwrite_unicode(args.output, result['image'])
    payload = {
      'ok': True,
      'output': args.output,
      'quality': result.get('quality_used', args.quality),
      'engineUsed': result.get('engine_used'),
      'fallbackUsed': result.get('fallback_used', False),
      'confidence': result.get('confidence'),
      'diagnostics': result.get('diagnostics', {}),
    }
    print(json.dumps(payload), flush=True)
  except Exception as exc:
    print(json.dumps({
      'ok': False,
      'error': str(exc),
      'detail': traceback.format_exc(),
    }), flush=True)


def cmd_extract(args):
  if not os.path.isfile(args.input):
    print(json.dumps({'ok': False, 'error': f'Input file not found: {args.input}'}), flush=True)
    return

  try:
    _apply_models_dir(args)
    from rwm_engine import extract_watermark
  except ImportError as exc:
    print(json.dumps({
      'ok': False,
      'error': f'Cannot import dependencies: {exc}. Run: pip install -r blind_watermark/requirements.txt',
    }), flush=True)
    return

  try:
    image = imread_unicode(args.input)
    if image is None:
      print(json.dumps({'ok': False, 'error': f'Cannot read image: {args.input}'}), flush=True)
      return

    result = extract_watermark(
      img=image,
      password=args.password,
      quality=args.quality,
      engine=args.engine,
      models_dir=args.models_dir or None,
    )
    if result.get('ok'):
      payload = {
        'ok': True,
        'wm': result.get('wm'),
        'engineUsed': result.get('engine_used'),
        'fallbackUsed': result.get('fallback_used', False),
        'confidence': result.get('confidence'),
        'diagnostics': result.get('diagnostics', {}),
      }
      print(json.dumps(payload), flush=True)
    else:
      payload = dict(result)
      if 'engine_used' in payload:
        payload['engineUsed'] = payload.pop('engine_used')
      if 'fallback_used' in payload:
        payload['fallbackUsed'] = payload.pop('fallback_used')
      print(json.dumps(payload), flush=True)
  except Exception as exc:
    print(json.dumps({
      'ok': False,
      'error': str(exc),
      'detail': traceback.format_exc(),
    }), flush=True)


def parse_args():
  if len(sys.argv) == 2 and sys.argv[1] == '--json-stdin':
    raw = sys.stdin.buffer.read()
    opts = json.loads(raw.decode('utf-8'))

    class _Args:
      pass

    args = _Args()
    args.mode = opts['mode']
    args.input = opts.get('input', '')
    args.output = opts.get('output', '')
    args.wm = opts.get('wm', '')
    args.password = int(opts.get('password', 1))
    args.quality = opts.get('quality', 'balanced')
    args.self_check = opts.get('self_check', True)
    args.engine = opts.get('engine', 'auto')
    args.models_dir = opts.get('models_dir', '')
    return args

  parser = argparse.ArgumentParser(description='Robust Watermark Engine bridge')
  parser.add_argument('--mode', choices=['check', 'embed', 'extract'], required=True)
  parser.add_argument('--input', default='')
  parser.add_argument('--output', default='')
  parser.add_argument('--wm', default='')
  parser.add_argument('--password', type=int, default=1)
  parser.add_argument('--quality', choices=['invisible', 'balanced', 'robust'], default='balanced')
  parser.add_argument('--engine', choices=['auto', 'legacy', 'neural'], default='auto')
  parser.add_argument('--models-dir', default='')
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  if args.mode == 'check':
    cmd_check(args)
  elif args.mode == 'embed':
    cmd_embed(args)
  elif args.mode == 'extract':
    cmd_extract(args)


if __name__ == '__main__':
  main()
