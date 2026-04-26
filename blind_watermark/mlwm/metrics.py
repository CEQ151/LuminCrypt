from __future__ import annotations

import math

import cv2
import numpy as np

from .codec import decode_payload_bits


def psnr(a: np.ndarray, b: np.ndarray) -> float:
  arr_a = np.asarray(a, dtype=np.float32)
  arr_b = np.asarray(b, dtype=np.float32)
  mse = float(np.mean((arr_a - arr_b) ** 2))
  if mse <= 1e-12:
    return 99.0
  return 20.0 * math.log10(255.0 / math.sqrt(mse))


def ssim(a: np.ndarray, b: np.ndarray) -> float:
  arr_a = np.asarray(a, dtype=np.float32)
  arr_b = np.asarray(b, dtype=np.float32)
  if arr_a.ndim == 3:
    arr_a = cv2.cvtColor(arr_a.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    arr_b = cv2.cvtColor(arr_b.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
  c1 = (0.01 * 255) ** 2
  c2 = (0.03 * 255) ** 2
  mu_a = cv2.GaussianBlur(arr_a, (11, 11), 1.5)
  mu_b = cv2.GaussianBlur(arr_b, (11, 11), 1.5)
  mu_a2 = mu_a * mu_a
  mu_b2 = mu_b * mu_b
  mu_ab = mu_a * mu_b
  sigma_a2 = cv2.GaussianBlur(arr_a * arr_a, (11, 11), 1.5) - mu_a2
  sigma_b2 = cv2.GaussianBlur(arr_b * arr_b, (11, 11), 1.5) - mu_b2
  sigma_ab = cv2.GaussianBlur(arr_a * arr_b, (11, 11), 1.5) - mu_ab
  num = (2 * mu_ab + c1) * (2 * sigma_ab + c2)
  den = (mu_a2 + mu_b2 + c1) * (sigma_a2 + sigma_b2 + c2)
  return float(np.mean(num / np.maximum(den, 1e-6)))


def bit_accuracy(logits: np.ndarray, target_bits: np.ndarray) -> float:
  logits = np.asarray(logits)
  targets = np.asarray(target_bits)
  predicted = (logits >= 0).astype(np.float32)
  return float(np.mean(predicted == targets))


def exact_match_rate(logits: np.ndarray, target_bits: np.ndarray) -> float:
  logits = np.asarray(logits)
  targets = np.asarray(target_bits)
  predicted = (logits >= 0).astype(np.float32)
  if predicted.ndim == 1:
    return float(np.all(predicted == targets))
  return float(np.mean(np.all(predicted == targets, axis=1)))


def decode_success_rate(logits: np.ndarray, texts: list[str] | tuple[str, ...]) -> float:
  logits = np.asarray(logits)
  predicted = (logits >= 0).astype(np.float32)
  if predicted.ndim == 1:
    predicted = predicted.reshape(1, -1)
  ok = 0
  total = min(len(predicted), len(texts))
  if total <= 0:
    return 0.0
  for bits, text in zip(predicted[:total], texts[:total]):
    try:
      decoded = decode_payload_bits(bits)
    except Exception:
      continue
    ok += int(decoded.get('text') == text)
  return float(ok / total)
