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


def emit(payload):
  print(json.dumps(payload, ensure_ascii=False), flush=True)


def failure(code, stage, message, *, detail=None, **extra):
  payload = {
    'ok': False,
    'error': detail or message,
    'failureCode': code,
    'failureStage': stage,
    'userMessage': message,
    **extra,
  }
  emit(payload)


def public_embed_payload(result, output, quality):
  diagnostics = result.get('diagnostics', {})
  payload = {
    'ok': True,
    'output': output,
    'quality': result.get('quality_used', quality),
    'engineUsed': result.get('engine_used'),
    'fallbackUsed': result.get('fallback_used', False),
    'confidence': result.get('confidence'),
    'diagnostics': diagnostics,
  }
  for key in ('payloadMode', 'fingerprint', 'codec', 'berEstimate', 'spreadConfidence'):
    if diagnostics.get(key) is not None:
      payload[key] = diagnostics.get(key)
  if result.get('warningCode'):
    payload['warningCode'] = result.get('warningCode')
  if result.get('warnings'):
    payload['warnings'] = result.get('warnings')
  return payload


def public_extract_payload(result):
  payload = dict(result)
  if 'engine_used' in payload:
    payload['engineUsed'] = payload.pop('engine_used')
  if 'fallback_used' in payload:
    payload['fallbackUsed'] = payload.pop('fallback_used')
  diagnostics = payload.get('diagnostics', {}) or {}
  for key in ('payloadMode', 'fingerprint', 'codec', 'berEstimate', 'spreadConfidence'):
    if diagnostics.get(key) is not None:
      payload[key] = diagnostics.get(key)
  return payload


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
    emit(result)
  except ImportError as exc:
    emit({'ok': False, 'error': str(exc), 'failureCode': 'model_unavailable', 'failureStage': 'check'})


def cmd_embed(args):
  if not args.output:
    failure('invalid_request', 'embed', 'Output path is required.', detail='--output is required for embed mode')
    return
  if not args.wm:
    failure('invalid_request', 'embed', 'Watermark text is required.', detail='--wm is required for embed mode')
    return
  if not os.path.isfile(args.input):
    failure('input_unreadable', 'embed', 'The input image was not found.', detail=f'Input file not found: {args.input}')
    return

  try:
    _apply_models_dir(args)
    from rwm_engine import embed_watermark
  except ImportError as exc:
    emit({
      'ok': False,
      'error': f'Cannot import dependencies: {exc}. Run: pip install -r blind_watermark/requirements.txt',
      'failureCode': 'model_unavailable',
      'failureStage': 'embed',
    })
    return

  try:
    image = imread_unicode(args.input)
    if image is None:
      failure('input_unreadable', 'embed', 'The image could not be read.', detail=f'Cannot read image: {args.input}')
      return

    result = embed_watermark(
      img=image,
      text=args.wm,
      password=args.password,
      quality=args.quality,
      engine=args.engine,
      models_dir=args.models_dir or None,
      self_check=getattr(args, 'self_check', True),
      payload_mode=getattr(args, 'payload_mode', 'fingerprint64'),
    )
    if not result.get('ok'):
      emit(public_extract_payload(result))
      return

    if not imwrite_unicode(args.output, result['image']):
      failure('input_unreadable', 'embed', 'The output image could not be written.', detail=f'Cannot write image: {args.output}')
      return
    emit(public_embed_payload(result, args.output, args.quality))
  except Exception as exc:
    emit({
      'ok': False,
      'error': str(exc),
      'failureCode': 'engine_mismatch',
      'failureStage': 'embed',
      'detail': traceback.format_exc(),
    })


def cmd_extract(args):
  if not os.path.isfile(args.input):
    failure('input_unreadable', 'extract', 'The input image was not found.', detail=f'Input file not found: {args.input}')
    return

  try:
    _apply_models_dir(args)
    from rwm_engine import extract_watermark
  except ImportError as exc:
    emit({
      'ok': False,
      'error': f'Cannot import dependencies: {exc}. Run: pip install -r blind_watermark/requirements.txt',
      'failureCode': 'model_unavailable',
      'failureStage': 'extract',
    })
    return

  try:
    image = imread_unicode(args.input)
    if image is None:
      failure('input_unreadable', 'extract', 'The image could not be read.', detail=f'Cannot read image: {args.input}')
      return

    result = extract_watermark(
      img=image,
      password=args.password,
      quality=args.quality,
      engine=args.engine,
      models_dir=args.models_dir or None,
      payload_mode=getattr(args, 'payload_mode', None),
    )
    if result.get('ok'):
      diagnostics = result.get('diagnostics', {})
      payload = {
        'ok': True,
        'wm': result.get('wm'),
        'fingerprint': result.get('fingerprint') or diagnostics.get('fingerprint'),
        'payloadMode': result.get('payloadMode') or diagnostics.get('payloadMode'),
        'codec': diagnostics.get('codec'),
        'berEstimate': diagnostics.get('berEstimate'),
        'spreadConfidence': diagnostics.get('spreadConfidence'),
        'engineUsed': result.get('engine_used'),
        'fallbackUsed': result.get('fallback_used', False),
        'confidence': result.get('confidence'),
        'diagnostics': diagnostics,
      }
      emit(payload)
    else:
      emit(public_extract_payload(result))
  except Exception as exc:
    emit({
      'ok': False,
      'error': str(exc),
      'failureCode': 'engine_mismatch',
      'failureStage': 'extract',
      'detail': traceback.format_exc(),
    })


def cmd_warmup(args):
  try:
    _apply_models_dir(args)
    from rwm_engine import check_dependencies
    result = check_dependencies()
    if result.get('neuralReady'):
      try:
        from mlwm.infer import probe_runtime, _load_encoder_session, _load_decoder_session
        status = probe_runtime(args.models_dir or None)
        _load_encoder_session(str(status.encoder_path), False)
        _load_decoder_session(str(status.decoder_path), False)
        result['warmupReady'] = True
      except Exception as exc:
        result['warmupReady'] = False
        result['warmupError'] = str(exc)
    emit(result)
  except Exception as exc:
    emit({'ok': False, 'error': str(exc), 'failureCode': 'model_unavailable', 'failureStage': 'warmup'})


def _safe_replace_write(path, image):
  root, ext = os.path.splitext(path)
  tmp_path = f'{root}.tmp{ext or ".png"}'
  if not imwrite_unicode(tmp_path, image):
    return False
  os.replace(tmp_path, path)
  return True


def cmd_embed_batch(args):
  items = getattr(args, 'items', []) or []
  total = len(items)
  results = []
  batch_id = getattr(args, 'batch_id', '') or 'batch'
  if total == 0:
    failure('invalid_request', 'embed_batch', 'No images were selected for batch watermarking.')
    return
  try:
    _apply_models_dir(args)
    from rwm_engine import embed_watermark
  except ImportError as exc:
    failure('model_unavailable', 'embed_batch', 'The watermark backend is not available.', detail=str(exc))
    return

  for index, item in enumerate(items):
    input_path = item.get('input') or ''
    output_path = item.get('output') or ''
    self_check = bool(item.get('self_check', False))
    progress_base = {
      'event': 'progress',
      'batchId': batch_id,
      'index': index,
      'total': total,
      'input': input_path,
      'output': output_path,
    }
    emit({**progress_base, 'status': 'running', 'progress': index / total})
    try:
      image = imread_unicode(input_path)
      if image is None:
        raise ValueError('Cannot read image')
      result = embed_watermark(
        img=image,
        text=args.wm,
        password=args.password,
        quality=args.quality,
        engine=args.engine,
        models_dir=args.models_dir or None,
        self_check=self_check,
        payload_mode=getattr(args, 'payload_mode', 'fingerprint64'),
      )
      if not result.get('ok'):
        item_result = public_extract_payload(result)
        item_result.update({'input': input_path, 'output': output_path, 'index': index, 'status': 'failed'})
      elif not _safe_replace_write(output_path, result['image']):
        item_result = {
          'ok': False,
          'input': input_path,
          'output': output_path,
          'index': index,
          'status': 'failed',
          'failureCode': 'input_unreadable',
          'failureStage': 'embed_batch',
          'error': f'Cannot write image: {output_path}',
        }
      else:
        item_result = public_embed_payload(result, output_path, args.quality)
        item_result.update({'input': input_path, 'index': index, 'status': 'done'})
    except Exception as exc:
      item_result = {
        'ok': False,
        'input': input_path,
        'output': output_path,
        'index': index,
        'status': 'failed',
        'failureCode': 'engine_mismatch',
        'failureStage': 'embed_batch',
        'error': str(exc),
      }
    results.append(item_result)
    emit({
      **progress_base,
      'status': 'done' if item_result.get('ok') else 'failed',
      'progress': (index + 1) / total,
      'failureCode': item_result.get('failureCode'),
      'error': item_result.get('error'),
    })

  success_count = sum(1 for item in results if item.get('ok'))
  emit({
    'event': 'complete',
    'ok': success_count == total,
    'batchId': batch_id,
    'total': total,
    'successCount': success_count,
    'failureCount': total - success_count,
    'failureCode': None if success_count == total else 'batch_partial_failure',
    'results': results,
  })


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
    args.payload_mode = opts.get('payload_mode', opts.get('payloadMode', 'fingerprint64'))
    args.items = opts.get('items', [])
    args.batch_id = opts.get('batch_id', '')
    return args

  parser = argparse.ArgumentParser(description='Robust Watermark Engine bridge')
  parser.add_argument('--mode', choices=['check', 'warmup', 'embed', 'extract', 'embed_batch'], required=True)
  parser.add_argument('--input', default='')
  parser.add_argument('--output', default='')
  parser.add_argument('--wm', default='')
  parser.add_argument('--password', type=int, default=1)
  parser.add_argument('--quality', choices=['trace', 'faint', 'light', 'invisible', 'balanced', 'strong', 'robust'], default='balanced')
  parser.add_argument('--engine', choices=['auto', 'legacy', 'neural'], default='auto')
  parser.add_argument('--payload-mode', choices=['fingerprint64', 'text16'], default='fingerprint64')
  parser.add_argument('--models-dir', default='')
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  if args.mode == 'check':
    cmd_check(args)
  elif args.mode == 'warmup':
    cmd_warmup(args)
  elif args.mode == 'embed':
    cmd_embed(args)
  elif args.mode == 'extract':
    cmd_extract(args)
  elif args.mode == 'embed_batch':
    cmd_embed_batch(args)


if __name__ == '__main__':
  main()
