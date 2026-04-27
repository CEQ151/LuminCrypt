from __future__ import annotations

import argparse
import csv
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from .traceability import utc_now_iso, write_json


USER_AGENT = 'LuminCrypt-MLWM/1.0'


def image_url(base_url: str, width: int, quality: int) -> str:
  parsed = urllib.parse.urlparse(base_url)
  query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
  query.update({
    'auto': 'format',
    'fit': 'max',
    'w': str(width),
    'q': str(quality),
  })
  return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))


def iter_rows(photos_file: str, *, limit: int | None = None, min_size: int = 512):
  with Path(photos_file).open('r', encoding='utf-8', newline='') as f:
    reader = csv.DictReader(f, delimiter='\t')
    count = 0
    for row in reader:
      try:
        width = int(float(row.get('photo_width') or 0))
        height = int(float(row.get('photo_height') or 0))
      except ValueError:
        continue
      if min(width, height) < min_size:
        continue
      if not row.get('photo_id') or not row.get('photo_image_url'):
        continue
      yield row
      count += 1
      if limit is not None and count >= limit:
        break


def download_one(row: dict, out_dir: Path, *, width: int, quality: int, timeout: int, retries: int) -> dict:
  photo_id = row['photo_id']
  target = out_dir / f'{photo_id}.jpg'
  url = image_url(row['photo_image_url'], width, quality)
  record = {
    'photoId': photo_id,
    'target': str(target),
    'sourceUrl': row.get('photo_url'),
    'imageUrl': url,
    'ok': False,
    'error': None,
  }
  if target.exists() and target.stat().st_size > 0:
    record['ok'] = True
    record['skipped'] = True
    record['bytes'] = target.stat().st_size
    return record

  request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
  last_error = None
  for attempt in range(retries + 1):
    try:
      with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read()
      if len(data) < 1024:
        raise ValueError('downloaded file is unexpectedly small')
      tmp = target.with_suffix('.tmp')
      tmp.write_bytes(data)
      tmp.replace(target)
      record['ok'] = True
      record['bytes'] = len(data)
      return record
    except (OSError, urllib.error.URLError, ValueError) as exc:
      last_error = str(exc)
      if attempt < retries:
        time.sleep(0.5 * (attempt + 1))
  record['error'] = last_error
  return record


def download_dataset(
  photos_file: str,
  out_dir: str,
  *,
  limit: int | None = None,
  min_size: int = 512,
  width: int = 1024,
  quality: int = 85,
  workers: int = 8,
  timeout: int = 45,
  retries: int = 2,
) -> dict:
  out = Path(out_dir)
  out.mkdir(parents=True, exist_ok=True)
  rows = list(iter_rows(photos_file, limit=limit, min_size=min_size))
  results = []
  with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
    futures = [
      executor.submit(download_one, row, out, width=width, quality=quality, timeout=timeout, retries=retries)
      for row in rows
    ]
    for future in as_completed(futures):
      results.append(future.result())

  ok = sum(1 for result in results if result.get('ok'))
  failed = len(results) - ok
  manifest = {
    'createdAt': utc_now_iso(),
    'photosFile': str(Path(photos_file).resolve()),
    'outDir': str(out.resolve()),
    'limit': limit,
    'minSize': min_size,
    'width': width,
    'quality': quality,
    'workers': workers,
    'counts': {
      'requested': len(rows),
      'ok': ok,
      'failed': failed,
    },
    'results': sorted(results, key=lambda item: item['photoId']),
  }
  write_json(out / 'download_manifest.json', manifest)
  return manifest


def main() -> None:
  parser = argparse.ArgumentParser(description='Download images referenced by Unsplash Lite photos.csv000')
  parser.add_argument('--photos-file', required=True)
  parser.add_argument('--out-dir', default='data/unsplash_lite_raw')
  parser.add_argument('--limit', type=int)
  parser.add_argument('--min-size', type=int, default=512)
  parser.add_argument('--width', type=int, default=1024)
  parser.add_argument('--quality', type=int, default=85)
  parser.add_argument('--workers', type=int, default=8)
  parser.add_argument('--timeout', type=int, default=45)
  parser.add_argument('--retries', type=int, default=2)
  args = parser.parse_args()

  manifest = download_dataset(
    args.photos_file,
    args.out_dir,
    limit=args.limit,
    min_size=args.min_size,
    width=args.width,
    quality=args.quality,
    workers=args.workers,
    timeout=args.timeout,
    retries=args.retries,
  )
  print(json.dumps(manifest['counts'], indent=2, sort_keys=True))


if __name__ == '__main__':
  main()
