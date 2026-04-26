from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np


@dataclass
class AttackConfig:
  ops_per_sample_min: int = 2
  ops_per_sample_max: int = 5
  jpeg_quality: tuple[int, int] = (30, 95)
  webp_quality: tuple[int, int] = (25, 90)
  resize_scale: tuple[float, float] = (0.45, 1.4)
  crop_keep: tuple[float, float] = (0.8, 1.0)
  rotation_deg: tuple[float, float] = (-7.0, 7.0)
  perspective_ratio: tuple[float, float] = (0.0, 0.04)
  gaussian_blur_sigma: tuple[float, float] = (0.0, 2.0)
  motion_blur_ksize: tuple[int, int] = (3, 9)
  gaussian_noise_std: tuple[float, float] = (0.0, 8.0 / 255.0)
  overlay_area: tuple[float, float] = (0.03, 0.15)
  overlay_alpha: tuple[float, float] = (0.15, 0.5)

  @classmethod
  def from_dict(cls, data: dict[str, Any]) -> 'AttackConfig':
    return cls(
      ops_per_sample_min=int(data.get('ops_per_sample', {}).get('min', 2)),
      ops_per_sample_max=int(data.get('ops_per_sample', {}).get('max', 5)),
      jpeg_quality=tuple(data.get('jpeg_quality', (30, 95))),
      webp_quality=tuple(data.get('webp_quality', (25, 90))),
      resize_scale=tuple(data.get('resize_scale', (0.45, 1.4))),
      crop_keep=tuple(data.get('crop_keep', (0.8, 1.0))),
      rotation_deg=tuple(data.get('rotation_deg', (-7.0, 7.0))),
      perspective_ratio=tuple(data.get('perspective_ratio', (0.0, 0.04))),
      gaussian_blur_sigma=tuple(data.get('gaussian_blur_sigma', (0.0, 2.0))),
      motion_blur_ksize=tuple(data.get('motion_blur_ksize', (3, 9))),
      gaussian_noise_std=tuple(data.get('gaussian_noise_std', (0.0, 8.0 / 255.0))),
      overlay_area=tuple(data.get('overlay_area', (0.03, 0.15))),
      overlay_alpha=tuple(data.get('overlay_alpha', (0.15, 0.5))),
    )


def _encode_decode(image: np.ndarray, ext: str, params: list[int]) -> np.ndarray:
  ok, buf = cv2.imencode(ext, image[:, :, ::-1], params)
  if not ok:
    return image
  dec = cv2.imdecode(buf, cv2.IMREAD_COLOR)
  if dec is None:
    return image
  return dec[:, :, ::-1]


def attack_jpeg(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  quality = rng.randint(*cfg.jpeg_quality)
  return _encode_decode(image, '.jpg', [int(cv2.IMWRITE_JPEG_QUALITY), quality])


def attack_webp(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  quality = rng.randint(*cfg.webp_quality)
  return _encode_decode(image, '.webp', [int(cv2.IMWRITE_WEBP_QUALITY), quality])


def attack_resize(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  h, w = image.shape[:2]
  scale = rng.uniform(*cfg.resize_scale)
  nh = max(32, int(h * scale))
  nw = max(32, int(w * scale))
  interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC
  resized = cv2.resize(image, (nw, nh), interpolation=interp)
  return cv2.resize(resized, (w, h), interpolation=cv2.INTER_CUBIC)


def attack_crop(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  h, w = image.shape[:2]
  keep = rng.uniform(*cfg.crop_keep)
  ch = max(32, int(h * keep))
  cw = max(32, int(w * keep))
  y0 = rng.randint(0, max(0, h - ch))
  x0 = rng.randint(0, max(0, w - cw))
  crop = image[y0:y0 + ch, x0:x0 + cw]
  return cv2.resize(crop, (w, h), interpolation=cv2.INTER_CUBIC)


def attack_rotate(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  h, w = image.shape[:2]
  angle = rng.uniform(*cfg.rotation_deg)
  matrix = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), angle, 1.0)
  return cv2.warpAffine(image, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def attack_perspective(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  h, w = image.shape[:2]
  ratio = rng.uniform(*cfg.perspective_ratio)
  dx = int(w * ratio)
  dy = int(h * ratio)
  src = np.float32([[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]])
  dst = np.float32([
    [rng.randint(0, dx), rng.randint(0, dy)],
    [w - 1 - rng.randint(0, dx), rng.randint(0, dy)],
    [rng.randint(0, dx), h - 1 - rng.randint(0, dy)],
    [w - 1 - rng.randint(0, dx), h - 1 - rng.randint(0, dy)],
  ])
  matrix = cv2.getPerspectiveTransform(src, dst)
  return cv2.warpPerspective(image, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def attack_gaussian_blur(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  sigma = rng.uniform(*cfg.gaussian_blur_sigma)
  if sigma <= 1e-6:
    return image
  return cv2.GaussianBlur(image, (0, 0), sigmaX=sigma, sigmaY=sigma)


def attack_motion_blur(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  k = rng.randint(*cfg.motion_blur_ksize)
  if k % 2 == 0:
    k += 1
  kernel = np.zeros((k, k), dtype=np.float32)
  kernel[k // 2, :] = 1.0 / k
  angle = rng.uniform(0.0, 180.0)
  center = (k / 2.0, k / 2.0)
  matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
  kernel = cv2.warpAffine(kernel, matrix, (k, k))
  kernel_sum = np.sum(kernel)
  kernel = kernel / kernel_sum if kernel_sum > 0 else kernel
  return cv2.filter2D(image, -1, kernel)


def attack_gaussian_noise(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  std = rng.uniform(*cfg.gaussian_noise_std)
  if std <= 1e-8:
    return image
  noise = np.random.default_rng(rng.randint(0, 2**31 - 1)).normal(0.0, std * 255.0, size=image.shape)
  return np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)


def attack_color_jitter(image: np.ndarray, rng: random.Random) -> np.ndarray:
  out = image.astype(np.float32)
  alpha = rng.uniform(0.85, 1.15)
  beta = rng.uniform(-12.0, 12.0)
  out = np.clip(out * alpha + beta, 0, 255)
  hsv = cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
  hsv[..., 1] = np.clip(hsv[..., 1] * rng.uniform(0.85, 1.2), 0, 255)
  hsv[..., 2] = np.clip(hsv[..., 2] * rng.uniform(0.9, 1.1), 0, 255)
  out = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
  gamma = rng.uniform(0.85, 1.15)
  out = np.clip(((out / 255.0) ** gamma) * 255.0, 0, 255)
  return out.astype(np.uint8)


def attack_sharpen(image: np.ndarray, rng: random.Random) -> np.ndarray:
  blur = cv2.GaussianBlur(image, (0, 0), sigmaX=1.2)
  alpha = rng.uniform(0.15, 0.6)
  return np.clip(image.astype(np.float32) * (1.0 + alpha) - blur.astype(np.float32) * alpha, 0, 255).astype(np.uint8)


def attack_corner_overlay(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  h, w = image.shape[:2]
  area = rng.uniform(*cfg.overlay_area)
  alpha = rng.uniform(*cfg.overlay_alpha)
  oh = max(16, int(h * area))
  ow = max(16, int(w * area))
  corner = rng.choice(['tl', 'tr', 'bl', 'br'])
  if corner == 'tl':
    y0, x0 = 0, 0
  elif corner == 'tr':
    y0, x0 = 0, w - ow
  elif corner == 'bl':
    y0, x0 = h - oh, 0
  else:
    y0, x0 = h - oh, w - ow
  color = np.array([rng.randint(180, 255), rng.randint(180, 255), rng.randint(180, 255)], dtype=np.float32)
  out = image.astype(np.float32)
  out[y0:y0 + oh, x0:x0 + ow] = out[y0:y0 + oh, x0:x0 + ow] * (1.0 - alpha) + color * alpha
  return np.clip(out, 0, 255).astype(np.uint8)


def attack_screenshot_sim(image: np.ndarray, cfg: AttackConfig, rng: random.Random) -> np.ndarray:
  out = attack_resize(image, cfg, rng)
  out = attack_sharpen(out, rng)
  out = attack_color_jitter(out, rng)
  out = attack_jpeg(out, cfg, rng)
  return out


ATTACK_REGISTRY = {
  'jpeg': attack_jpeg,
  'webp': attack_webp,
  'resize': attack_resize,
  'crop': attack_crop,
  'rotate': attack_rotate,
  'perspective': attack_perspective,
  'gaussian_blur': attack_gaussian_blur,
  'motion_blur': attack_motion_blur,
  'gaussian_noise': attack_gaussian_noise,
  'color_jitter': lambda image, cfg, rng: attack_color_jitter(image, rng),
  'sharpen': lambda image, cfg, rng: attack_sharpen(image, rng),
  'corner_overlay': attack_corner_overlay,
  'screenshot_sim': attack_screenshot_sim,
}


def apply_random_attack_chain(
  image: np.ndarray,
  *,
  config: AttackConfig,
  rng: random.Random | None = None,
  strength: str = 'medium',
) -> np.ndarray:
  if strength in {'clean', 'none', 'off'}:
    return np.asarray(image, dtype=np.uint8).copy()
  local_rng = rng or random.Random()
  out = np.asarray(image, dtype=np.uint8).copy()
  names = list(ATTACK_REGISTRY.keys())
  max_ops = config.ops_per_sample_max + (1 if strength == 'hard' else 0)
  min_ops = config.ops_per_sample_min if strength != 'mixed' else 1
  num_ops = local_rng.randint(min_ops, max_ops)
  chosen = local_rng.sample(names, k=min(num_ops, len(names)))
  for name in chosen:
    out = ATTACK_REGISTRY[name](out, config, local_rng)
  return out
