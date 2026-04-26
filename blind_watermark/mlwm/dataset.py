from __future__ import annotations

import random
from pathlib import Path

import cv2
import numpy as np

from .attacks import AttackConfig
from .codec import PAYLOAD_BITS, encode_text_payload
from .traceability import dataset_manifest_hash

try:
  import torch
  from torch.utils.data import Dataset
except ImportError:  # pragma: no cover
  torch = None
  Dataset = object


IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.bmp', '.webp', '.tif', '.tiff'}
PAYLOAD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def require_torch_dataset():
  if torch is None:
    raise ImportError('PyTorch is required for MLWM dataset/training')
  return torch


def discover_images(root: str) -> list[str]:
  base = Path(root)
  if not base.exists():
    return []
  return [
    str(path)
    for path in sorted(base.rglob('*'))
    if path.is_file() and path.suffix.lower() in IMAGE_EXTS
  ]


def load_rgb_image(path: str) -> np.ndarray:
  image = cv2.imread(path, cv2.IMREAD_COLOR)
  if image is None:
    raise ValueError(f'cannot read image: {path}')
  return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def center_crop_resize(image, size: int):
  h, w = image.shape[:2]
  edge = min(h, w)
  y0 = max(0, (h - edge) // 2)
  x0 = max(0, (w - edge) // 2)
  crop = image[y0:y0 + edge, x0:x0 + edge]
  return cv2.resize(crop, (size, size), interpolation=cv2.INTER_AREA)


def sample_payload_text(rng: random.Random, *, min_bytes: int = 6, max_bytes: int = 16) -> str:
  target_len = rng.randint(min_bytes, max_bytes)
  chars = [rng.choice(PAYLOAD_ALPHABET) for _ in range(target_len)]
  return ''.join(chars)


def build_fixed_residual_map(bits, height: int, width: int, scale: float):
  torch_mod = require_torch_dataset()
  bit_tensor = bits.view(16, 16) * 2.0 - 1.0
  bit_tensor = bit_tensor.unsqueeze(0).unsqueeze(0)
  grid = torch_mod.nn.functional.interpolate(bit_tensor, size=(height, width), mode='nearest')
  grid = grid.repeat(1, 3, 1, 1)
  return grid * scale


class SyntheticPayloadImageDataset(Dataset):
  def __init__(self, root: str, image_size: int, seed: int = 20260426) -> None:
    require_torch_dataset()
    self.paths = discover_images(root)
    if not self.paths:
      raise ValueError(f'no images found under {root}')
    self.image_size = image_size
    self.base_seed = seed
    self.manifest_hash = dataset_manifest_hash(self.paths)

  def __len__(self) -> int:
    return len(self.paths)

  def __getitem__(self, index: int):
    torch_mod = require_torch_dataset()
    rng = random.Random(self.base_seed + index)
    path = self.paths[index]
    image = center_crop_resize(load_rgb_image(path), self.image_size)
    text = sample_payload_text(rng)
    payload = encode_text_payload(text)
    image_tensor = torch_mod.from_numpy(image).permute(2, 0, 1).float() / 255.0
    bits_tensor = torch_mod.from_numpy(payload.bits.copy()).float()
    if bits_tensor.numel() != PAYLOAD_BITS:
      raise AssertionError('unexpected payload length')
    return {
      'path': path,
      'image': image_tensor,
      'bits': bits_tensor,
      'text': text,
    }


def attack_config_from_dict(data: dict) -> AttackConfig:
  return AttackConfig.from_dict(data)
