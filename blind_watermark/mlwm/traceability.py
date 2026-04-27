from __future__ import annotations

import hashlib
import json
import os
import platform
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
  return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sha256_bytes(data: bytes) -> str:
  return hashlib.sha256(data).hexdigest()


def sha256_file(path: str | os.PathLike[str]) -> str:
  h = hashlib.sha256()
  with open(path, 'rb') as f:
    for chunk in iter(lambda: f.read(1024 * 1024), b''):
      h.update(chunk)
  return h.hexdigest()


def stable_json_dumps(obj: Any) -> str:
  return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def config_hash(config: dict[str, Any]) -> str:
  return sha256_bytes(stable_json_dumps(config).encode('utf-8'))


def write_json(path: str | os.PathLike[str], payload: Any) -> None:
  target = Path(path)
  target.parent.mkdir(parents=True, exist_ok=True)
  target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def _git_output(args: list[str], cwd: str | None = None) -> str | None:
  try:
    return subprocess.check_output(args, cwd=cwd, stderr=subprocess.DEVNULL).decode('utf-8').strip()
  except Exception:
    return None


def git_snapshot(repo_root: str | None = None) -> dict[str, Any]:
  root = repo_root or os.getcwd()
  branch = _git_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], cwd=root)
  commit = _git_output(['git', 'rev-parse', 'HEAD'], cwd=root)
  short = _git_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=root)
  dirty = _git_output(['git', 'status', '--porcelain'], cwd=root)
  return {
    'branch': branch,
    'commit': commit,
    'shortCommit': short,
    'dirty': bool(dirty),
  }


def gpu_snapshot() -> dict[str, Any]:
  query = [
    'nvidia-smi',
    '--query-gpu=name,driver_version,memory.total',
    '--format=csv,noheader,nounits',
  ]
  try:
    row = subprocess.check_output(query, stderr=subprocess.DEVNULL).decode('utf-8').strip().splitlines()[0]
    name, driver, memory_mb = [part.strip() for part in row.split(',')]
    return {
      'name': name,
      'driverVersion': driver,
      'memoryMB': int(memory_mb),
    }
  except Exception:
    return {
      'name': None,
      'driverVersion': None,
      'memoryMB': None,
    }


def environment_snapshot() -> dict[str, Any]:
  return {
    'pythonVersion': platform.python_version(),
    'platform': platform.platform(),
    'cudaVersion': _git_output(['nvidia-smi'], cwd=None),
    'gpu': gpu_snapshot(),
    'timestamp': utc_now_iso(),
  }


def dataset_manifest_hash(paths: list[str]) -> str:
  normalized = [str(Path(p).as_posix()) for p in sorted(paths)]
  return sha256_bytes('\n'.join(normalized).encode('utf-8'))


def build_run_manifest(
  *,
  repo_root: str,
  config: dict[str, Any],
  train_dir: str,
  val_dir: str,
  dataset_hash: str,
  output_dir: str,
  promoted: bool = False,
  extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
  manifest = {
    'git': git_snapshot(repo_root),
    'environment': environment_snapshot(),
    'trainDir': train_dir,
    'valDir': val_dir,
    'datasetManifestHash': dataset_hash,
    'configHash': config_hash(config),
    'outputDir': output_dir,
    'promoted': promoted,
    'createdAt': utc_now_iso(),
  }
  if extra:
    manifest.update(extra)
  return manifest
