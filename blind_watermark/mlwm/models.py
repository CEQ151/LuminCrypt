from __future__ import annotations

from typing import Any

try:
  import torch
  import torch.nn.functional as F
  from torch import nn
except ImportError:  # pragma: no cover - exercised when runtime env lacks torch
  torch = None
  nn = None
  F = None


def require_torch() -> tuple[Any, Any, Any]:
  if torch is None or nn is None or F is None:
    raise ImportError('PyTorch is required for MLWM training/export')
  return torch, nn, F


if nn is not None:
  class ConvBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
      super().__init__()
      self.net = nn.Sequential(
        nn.Conv2d(in_channels, out_channels, 3, padding=1),
        nn.BatchNorm2d(out_channels),
        nn.GELU(),
        nn.Conv2d(out_channels, out_channels, 3, padding=1),
        nn.BatchNorm2d(out_channels),
        nn.GELU(),
      )

    def forward(self, x):
      return self.net(x)


  class DownBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
      super().__init__()
      self.pool = nn.MaxPool2d(2)
      self.block = ConvBlock(in_channels, out_channels)

    def forward(self, x):
      return self.block(self.pool(x))


  class UpBlock(nn.Module):
    def __init__(self, in_channels: int, skip_channels: int, out_channels: int) -> None:
      super().__init__()
      self.up = nn.Upsample(scale_factor=2, mode='bilinear', align_corners=False)
      self.block = ConvBlock(in_channels + skip_channels, out_channels)

    def forward(self, x, skip):
      x = self.up(x)
      if x.shape[-2:] != skip.shape[-2:]:
        x = F.interpolate(x, size=skip.shape[-2:], mode='bilinear', align_corners=False)
      x = torch.cat([x, skip], dim=1)
      return self.block(x)


  class EncoderNet(nn.Module):
    def __init__(self, payload_bits: int = 256, residual_scale: float = 8.0 / 255.0) -> None:
      super().__init__()
      self.payload_bits = payload_bits
      self.residual_scale = residual_scale
      self.payload_mlp = nn.Sequential(
        nn.Linear(payload_bits, 128),
        nn.GELU(),
        nn.Linear(128, 64),
        nn.GELU(),
      )
      self.enc1 = ConvBlock(3, 32)
      self.enc2 = DownBlock(32, 64)
      self.enc3 = DownBlock(64, 96)
      self.enc4 = DownBlock(96, 128)
      self.bottleneck = ConvBlock(128 + 64, 128)
      self.up3 = UpBlock(128 + 64, 96, 96)
      self.up2 = UpBlock(96 + 64, 64, 64)
      self.up1 = UpBlock(128, 32, 32)
      self.head = nn.Sequential(
        nn.Conv2d(32, 16, 3, padding=1),
        nn.GELU(),
        nn.Conv2d(16, 3, 1),
        nn.Tanh(),
      )

    def _payload_map(self, payload_bits, height: int, width: int):
      latent = self.payload_mlp(payload_bits)
      return latent[:, :, None, None].expand(-1, -1, height, width)

    def forward(self, image, payload_bits):
      x1 = self.enc1(image)
      x2 = self.enc2(x1)
      x3 = self.enc3(x2)
      x4 = self.enc4(x3)
      p4 = self._payload_map(payload_bits, x4.shape[-2], x4.shape[-1])
      b = self.bottleneck(torch.cat([x4, p4], dim=1))
      p3 = self._payload_map(payload_bits, x3.shape[-2], x3.shape[-1])
      u3 = self.up3(torch.cat([b, self._payload_map(payload_bits, b.shape[-2], b.shape[-1])], dim=1), x3)
      u3 = torch.cat([u3, p3], dim=1)
      u2 = self.up2(u3, x2)
      u2 = torch.cat([u2, self._payload_map(payload_bits, u2.shape[-2], u2.shape[-1])], dim=1)
      u1 = self.up1(u2, x1)
      residual = self.head(u1) * self.residual_scale
      return residual


  class DecoderNet(nn.Module):
    def __init__(self, payload_bits: int = 256) -> None:
      super().__init__()
      self.payload_bits = payload_bits
      self.features = nn.Sequential(
        ConvBlock(3, 32),
        nn.MaxPool2d(2),
        ConvBlock(32, 64),
        nn.MaxPool2d(2),
        ConvBlock(64, 96),
        nn.MaxPool2d(2),
        ConvBlock(96, 128),
        nn.AdaptiveAvgPool2d((1, 1)),
      )
      self.fc = nn.Sequential(
        nn.Flatten(),
        nn.Linear(128, 256),
        nn.GELU(),
      )
      self.payload_head = nn.Linear(256, payload_bits)
      self.confidence_head = nn.Linear(256, 1)

    def forward(self, image):
      feat = self.features(image)
      hidden = self.fc(feat)
      return self.payload_head(hidden), self.confidence_head(hidden)


  def build_models(payload_bits: int = 256, residual_scale: float = 8.0 / 255.0):
    return EncoderNet(payload_bits=payload_bits, residual_scale=residual_scale), DecoderNet(payload_bits=payload_bits)
else:
  class EncoderNet:  # pragma: no cover - placeholder when torch missing
    def __init__(self, *args, **kwargs) -> None:
      raise ImportError('PyTorch is required for MLWM training/export')


  class DecoderNet:
    def __init__(self, *args, **kwargs) -> None:
      raise ImportError('PyTorch is required for MLWM training/export')


  def build_models(*args, **kwargs):
    raise ImportError('PyTorch is required for MLWM training/export')
