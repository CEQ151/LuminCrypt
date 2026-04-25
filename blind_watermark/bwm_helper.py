#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bwm_helper.py — CLI bridge between Electron main process and rwm_engine.
Outputs a single JSON line to stdout.
"""

import sys
import os
import json
import argparse
import traceback
import numpy as np

# Force UTF-8 stdout/stderr on all platforms (critical for Windows PyInstaller exe)
if sys.stdout.encoding and sys.stdout.encoding.upper() not in ('UTF-8', 'UTF8'):
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)
if sys.stderr.encoding and sys.stderr.encoding.upper() not in ('UTF-8', 'UTF8'):
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', errors='replace', buffering=1)

_script_dir = os.path.dirname(os.path.abspath(__file__))
if _script_dir not in sys.path:
    sys.path.insert(0, _script_dir)


def imread_unicode(path, flags=None):
    """cv2.imread replacement that handles Unicode paths on Windows."""
    import cv2
    if flags is None:
        flags = cv2.IMREAD_UNCHANGED
    buf = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(buf, flags)


def imwrite_unicode(path, img, params=None):
    """cv2.imwrite replacement that handles Unicode paths on Windows."""
    import cv2
    ext = os.path.splitext(path)[1]
    ok, buf = cv2.imencode(ext, img, params or [])
    if ok:
        buf.tofile(path)
    return ok


def cmd_check(_args):
    """Verify that rwm_engine and all dependencies are available."""
    try:
        from rwm_engine import check_dependencies
        result = check_dependencies()
        if result['ok']:
            print(json.dumps({'ok': True, 'version': result['version']}), flush=True)
        else:
            print(json.dumps({
                'ok': False,
                'error': f"Missing dependencies: {', '.join(result['missing'])}. "
                         f"Run: pip install {' '.join(result['missing'])}"
            }), flush=True)
    except ImportError as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), flush=True)


def cmd_embed(args):
    """Embed a text watermark into an image."""
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
        from rwm_engine import embed_watermark
    except ImportError as exc:
        print(json.dumps({
            'ok': False,
            'error': f'Cannot import dependencies: {exc}. '
                     f'Run: pip install numpy opencv-python scipy reedsolo'
        }), flush=True)
        return

    try:
        img = imread_unicode(args.input)
        if img is None:
            print(json.dumps({'ok': False, 'error': f'Cannot read image: {args.input}'}), flush=True)
            return

        self_check = getattr(args, 'self_check', True)
        result = embed_watermark(
            img=img,
            text=args.wm,
            password=args.password,
            quality=args.quality,
            self_check=self_check,
        )

        imwrite_unicode(args.output, result)

        print(json.dumps({
            'ok': True,
            'output': args.output,
            'quality': args.quality,
        }), flush=True)

    except Exception as exc:
        print(json.dumps({
            'ok': False,
            'error': str(exc),
            'detail': traceback.format_exc()
        }), flush=True)


def cmd_extract(args):
    """Extract a text watermark from an image."""
    if not os.path.isfile(args.input):
        print(json.dumps({'ok': False, 'error': f'Input file not found: {args.input}'}), flush=True)
        return

    try:
        from rwm_engine import extract_watermark
    except ImportError as exc:
        print(json.dumps({
            'ok': False,
            'error': f'Cannot import dependencies: {exc}. '
                     f'Run: pip install numpy opencv-python scipy reedsolo'
        }), flush=True)
        return

    try:
        img = imread_unicode(args.input)
        if img is None:
            print(json.dumps({'ok': False, 'error': f'Cannot read image: {args.input}'}), flush=True)
            return

        wm_text = extract_watermark(
            img=img,
            password=args.password,
            quality=args.quality,
        )

        print(json.dumps({'ok': True, 'wm': wm_text}), flush=True)

    except ValueError as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), flush=True)
    except Exception as exc:
        print(json.dumps({
            'ok': False,
            'error': str(exc),
            'detail': traceback.format_exc()
        }), flush=True)


def main():
    # If first arg is '--json-stdin', read all options from a JSON object on stdin.
    # This avoids Windows command-line encoding issues with Unicode paths.
    if len(sys.argv) == 2 and sys.argv[1] == '--json-stdin':
        import io
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
    else:
        parser = argparse.ArgumentParser(description='Robust Watermark Engine — Electron bridge')
        parser.add_argument('--mode', choices=['check', 'embed', 'extract'], required=True,
                            help='Operation mode')
        parser.add_argument('--input', default='',
                            help='Path to the source image')
        parser.add_argument('--output', default='',
                            help='Path for the output image (embed only)')
        parser.add_argument('--wm', default='',
                            help='Watermark text to embed')
        parser.add_argument('--password', type=int, default=1,
                            help='Integer password for watermark encryption (default: 1)')
        parser.add_argument('--quality', choices=['invisible', 'balanced', 'robust'],
                            default='balanced',
                            help='Quality preset: invisible, balanced, robust (default: balanced)')
        args = parser.parse_args()

    if args.mode == 'check':
        cmd_check(args)
    elif args.mode == 'embed':
        cmd_embed(args)
    elif args.mode == 'extract':
        cmd_extract(args)


if __name__ == '__main__':
    main()
