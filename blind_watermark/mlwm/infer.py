from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from .codec import PAYLOAD_BITS, decode_payload_logits

try:
  import onnxruntime as ort
except ImportError:  # pragma: no cover
  ort = None


class NeuralRuntimeUnavailable(RuntimeError):
  pass


@dataclass
class NeuralModelStatus:
  models_dir: Path
  manifest: dict[str, Any]
  encoder_path: Path
  decoder_path: Path
  runtime_available: bool
  models_available: bool
  ready: bool


def resolve_models_dir(models_dir: str | None = None) -> Path:
  return Path(models_dir or 'resources/models/neural_wm').resolve()


def load_model_manifest(models_dir: str | None = None) -> dict[str, Any]:
  model_dir = resolve_models_dir(models_dir)
  manifest_path = model_dir / 'model.json'
  if not manifest_path.exists():
    return {'status': 'missing-manifest'}
  return json.loads(manifest_path.read_text(encoding='utf-8'))


def probe_runtime(models_dir: str | None = None) -> NeuralModelStatus:
  model_dir = resolve_models_dir(models_dir)
  manifest = load_model_manifest(str(model_dir))
  encoder_path = model_dir / manifest.get('encoder', {}).get('path', 'encoder.onnx')
  decoder_path = model_dir / manifest.get('decoder', {}).get('path', 'decoder.onnx')
  runtime_available = ort is not None
  models_available = encoder_path.exists() and decoder_path.exists()
  return NeuralModelStatus(
    models_dir=model_dir,
    manifest=manifest,
    encoder_path=encoder_path,
    decoder_path=decoder_path,
    runtime_available=runtime_available,
    models_available=models_available,
    ready=runtime_available and models_available,
  )


def _session_providers(use_cuda: bool) -> list[str]:
  if ort is None:
    return []
  available = ort.get_available_providers()
  if use_cuda and 'CUDAExecutionProvider' in available:
    return ['CUDAExecutionProvider', 'CPUExecutionProvider']
  return ['CPUExecutionProvider']


@lru_cache(maxsize=4)
def _load_encoder_session(path: str, use_cuda: bool):
  if ort is None:
    raise NeuralRuntimeUnavailable('onnxruntime is not installed')
  return ort.InferenceSession(path, providers=_session_providers(use_cuda))


@lru_cache(maxsize=4)
def _load_decoder_session(path: str, use_cuda: bool):
  if ort is None:
    raise NeuralRuntimeUnavailable('onnxruntime is not installed')
  return ort.InferenceSession(path, providers=_session_providers(use_cuda))


def _prepare_image(image_rgb: np.ndarray, image_size: int = 512) -> np.ndarray:
  resized = cv2.resize(image_rgb, (image_size, image_size), interpolation=cv2.INTER_AREA)
  return (resized.astype(np.float32) / 255.0).transpose(2, 0, 1)[None, ...]


def _manifest_image_size(manifest: dict[str, Any]) -> int:
  return int(manifest.get('imageSize') or 512)


def _resize_residual(residual: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
  h, w = shape
  residual = residual.squeeze(0).transpose(1, 2, 0)
  return cv2.resize(residual, (w, h), interpolation=cv2.INTER_CUBIC)


def _bits_array(payload_bits: np.ndarray) -> np.ndarray:
  bits = np.asarray(payload_bits, dtype=np.float32).reshape(1, PAYLOAD_BITS)
  if bits.shape[1] != PAYLOAD_BITS:
    raise ValueError(f'expected {PAYLOAD_BITS} payload bits')
  return bits


def neural_encode_residual(
  image_rgb: np.ndarray,
  payload_bits: np.ndarray,
  *,
  models_dir: str | None = None,
  use_cuda: bool = False,
) -> dict[str, Any]:
  status = probe_runtime(models_dir)
  if not status.ready:
    raise NeuralRuntimeUnavailable('neural models are not ready')
  session = _load_encoder_session(str(status.encoder_path), use_cuda)
  image_input = _prepare_image(image_rgb, _manifest_image_size(status.manifest))
  payload_input = _bits_array(payload_bits)
  outputs = session.run(None, {'image': image_input, 'payload_bits': payload_input})
  residual = np.asarray(outputs[0], dtype=np.float32)
  upsampled = _resize_residual(residual, image_rgb.shape[:2])
  return {
    'residual': upsampled,
    'manifest': status.manifest,
    'modelVersion': status.manifest.get('modelVersion'),
  }


def apply_neural_residual(
  image_rgb: np.ndarray,
  residual: np.ndarray,
  *,
  strength: float = 1.0,
) -> np.ndarray:
  out = image_rgb.astype(np.float32) / 255.0
  out = np.clip(out + residual.astype(np.float32) * strength, 0.0, 1.0)
  return np.clip(np.round(out * 255.0), 0, 255).astype(np.uint8)


def neural_decode_views(
  views_rgb: list[np.ndarray],
  *,
  models_dir: str | None = None,
  use_cuda: bool = False,
  password: int | None = None,
) -> dict[str, Any]:
  status = probe_runtime(models_dir)
  if not status.ready:
    raise NeuralRuntimeUnavailable('neural models are not ready')
  session = _load_decoder_session(str(status.decoder_path), use_cuda)
  attempts: list[dict[str, Any]] = []
  weighted_logits = np.zeros(PAYLOAD_BITS, dtype=np.float32)
  total_weight = 0.0
  for index, view in enumerate(views_rgb):
    outputs = session.run(None, {'image': _prepare_image(view, _manifest_image_size(status.manifest))})
    logits = np.asarray(outputs[0], dtype=np.float32).reshape(-1)
    confidence_logit = float(np.asarray(outputs[1], dtype=np.float32).reshape(-1)[0])
    confidence = 1.0 / (1.0 + np.exp(-confidence_logit))
    attempts.append({
      'index': index,
      'logits': logits,
      'confidence': confidence,
    })
    weighted_logits += logits * confidence
    total_weight += confidence
    try:
      decoded = decode_payload_logits(logits, password=password)
      decoded['confidence'] = confidence
      decoded['attemptIndex'] = index
      decoded['strategy'] = 'single-view'
      decoded['manifest'] = status.manifest
      return decoded
    except Exception:
      continue

  if total_weight <= 1e-8:
    raise NeuralRuntimeUnavailable('decoder produced no usable confidence scores')

  aggregated_logits = weighted_logits / total_weight
  decoded = decode_payload_logits(aggregated_logits, password=password)
  decoded['confidence'] = float(total_weight / max(len(views_rgb), 1))
  decoded['attempts'] = [{'index': a['index'], 'confidence': a['confidence']} for a in attempts]
  decoded['strategy'] = 'weighted-aggregate'
  decoded['manifest'] = status.manifest
  return decoded
