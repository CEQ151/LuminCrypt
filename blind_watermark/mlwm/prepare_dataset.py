from __future__ import annotations

import argparse
import json
import random
import shutil
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Iterable

import cv2

from .dataset import IMAGE_EXTS
from .traceability import utc_now_iso, write_json


@dataclass(frozen=True)
class ImageCandidate:
  path: Path
  sha256: str
  width: int
  height: int


def iter_image_paths(sources: Iterable[str]) -> list[Path]:
  paths: list[Path] = []
  for source in sources:
    root = Path(source)
    if root.is_file() and root.suffix.lower() in IMAGE_EXTS:
      paths.append(root)
    elif root.is_dir():
      paths.extend(
        path
        for path in root.rglob('*')
        if path.is_file() and path.suffix.lower() in IMAGE_EXTS
      )
  return sorted({path.resolve() for path in paths})


def sha256_path(path: Path) -> str:
  digest = sha256()
  with path.open('rb') as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b''):
      digest.update(chunk)
  return digest.hexdigest()


def inspect_image(path: Path, min_size: int) -> ImageCandidate | None:
  image = cv2.imread(str(path), cv2.IMREAD_COLOR)
  if image is None:
    return None
  h, w = image.shape[:2]
  if min(h, w) < min_size:
    return None
  return ImageCandidate(path=path, sha256=sha256_path(path), width=w, height=h)


def materialize(candidate: ImageCandidate, target_dir: Path, index: int, copy_mode: str) -> Path:
  ext = candidate.path.suffix.lower()
  target = target_dir / f'{index:06d}_{candidate.sha256[:12]}{ext}'
  if target.exists():
    return target
  if copy_mode == 'hardlink':
    try:
      target.hardlink_to(candidate.path)
      return target
    except OSError:
      pass
  shutil.copy2(candidate.path, target)
  return target


def prepare_dataset(
  sources: list[str],
  out_dir: str,
  *,
  val_ratio: float = 0.1,
  min_size: int = 512,
  limit: int | None = None,
  seed: int = 20260426,
  copy_mode: str = 'copy',
) -> dict:
  if not 0.0 < val_ratio < 0.5:
    raise ValueError('val_ratio must be between 0 and 0.5')
  if min_size <= 0:
    raise ValueError('min_size must be positive')
  if copy_mode not in {'copy', 'hardlink'}:
    raise ValueError('copy_mode must be copy or hardlink')

  out = Path(out_dir)
  train_dir = out / 'train_images'
  val_dir = out / 'val_images'
  train_dir.mkdir(parents=True, exist_ok=True)
  val_dir.mkdir(parents=True, exist_ok=True)

  seen: set[str] = set()
  candidates: list[ImageCandidate] = []
  rejected = 0
  for path in iter_image_paths(sources):
    candidate = inspect_image(path, min_size)
    if candidate is None:
      rejected += 1
      continue
    if candidate.sha256 in seen:
      continue
    seen.add(candidate.sha256)
    candidates.append(candidate)

  rng = random.Random(seed)
  rng.shuffle(candidates)
  if limit is not None:
    candidates = candidates[:max(0, limit)]

  val_count = max(1, int(round(len(candidates) * val_ratio))) if len(candidates) > 1 else 0
  val_set = candidates[:val_count]
  train_set = candidates[val_count:]

  train_records = []
  for index, candidate in enumerate(train_set, start=1):
    target = materialize(candidate, train_dir, index, copy_mode)
    train_records.append(record_for(candidate, target, train_dir))

  val_records = []
  for index, candidate in enumerate(val_set, start=1):
    target = materialize(candidate, val_dir, index, copy_mode)
    val_records.append(record_for(candidate, target, val_dir))

  manifest = {
    'createdAt': utc_now_iso(),
    'sources': sources,
    'outDir': str(out.resolve()),
    'seed': seed,
    'minSize': min_size,
    'valRatio': val_ratio,
    'copyMode': copy_mode,
    'rejected': rejected,
    'counts': {
      'train': len(train_records),
      'val': len(val_records),
      'total': len(train_records) + len(val_records),
    },
    'train': train_records,
    'val': val_records,
  }
  write_json(out / 'dataset_manifest.json', manifest)
  return manifest


def record_for(candidate: ImageCandidate, target: Path, base: Path) -> dict:
  return {
    'path': str(target.relative_to(base.parent)).replace('\\', '/'),
    'source': str(candidate.path),
    'sha256': candidate.sha256,
    'width': candidate.width,
    'height': candidate.height,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description='Prepare MLWM image dataset directories')
  parser.add_argument('--source', action='append', required=True, help='Source image file or directory. Repeatable.')
  parser.add_argument('--out-dir', default='data')
  parser.add_argument('--val-ratio', type=float, default=0.1)
  parser.add_argument('--min-size', type=int, default=512)
  parser.add_argument('--limit', type=int)
  parser.add_argument('--seed', type=int, default=20260426)
  parser.add_argument('--copy-mode', choices=['copy', 'hardlink'], default='copy')
  args = parser.parse_args()

  manifest = prepare_dataset(
    args.source,
    args.out_dir,
    val_ratio=args.val_ratio,
    min_size=args.min_size,
    limit=args.limit,
    seed=args.seed,
    copy_mode=args.copy_mode,
  )
  print(json.dumps(manifest['counts'], indent=2, sort_keys=True))


if __name__ == '__main__':
  main()
