import random
import unittest

import numpy as np

from blind_watermark.mlwm.attacks import AttackConfig, apply_random_attack_chain
from blind_watermark.mlwm.train import attack_batch

try:
  import torch
except ImportError:  # pragma: no cover
  torch = None


class AttackTests(unittest.TestCase):
  def test_clean_strength_is_identity_copy(self):
    image = np.random.default_rng(1).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    out = apply_random_attack_chain(image, config=AttackConfig(), rng=random.Random(1), strength='clean')
    self.assertTrue(np.array_equal(out, image))
    self.assertIsNot(out, image)

  @unittest.skipIf(torch is None, 'PyTorch is not installed')
  def test_attack_batch_uses_straight_through_gradient(self):
    image = torch.rand(1, 3, 40, 40, requires_grad=True)
    out = attack_batch(torch, image, AttackConfig(ops_per_sample_min=1, ops_per_sample_max=1), 'medium')
    self.assertTrue(out.requires_grad)
    out.sum().backward()
    self.assertIsNotNone(image.grad)


if __name__ == '__main__':
  unittest.main()
