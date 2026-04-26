import random
import unittest

import numpy as np

from blind_watermark.mlwm.attacks import AttackConfig, apply_random_attack_chain


class AttackTests(unittest.TestCase):
  def test_clean_strength_is_identity_copy(self):
    image = np.random.default_rng(1).integers(0, 256, (64, 64, 3), dtype=np.uint8)
    out = apply_random_attack_chain(image, config=AttackConfig(), rng=random.Random(1), strength='clean')
    self.assertTrue(np.array_equal(out, image))
    self.assertIsNot(out, image)


if __name__ == '__main__':
  unittest.main()
