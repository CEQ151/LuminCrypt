import unittest

import cv2
import numpy as np

from blind_watermark.mlwm import spread_v2


class SpreadV2Tests(unittest.TestCase):
  def test_fingerprint_payload_roundtrips_and_rejects_wrong_password(self):
    payload = spread_v2.encode_fingerprint_payload('hello world', 123)
    logits = np.where(payload.bits >= 0.5, 8.0, -8.0).astype(np.float32)

    decoded = spread_v2.decode_fingerprint_logits(logits, 123)

    self.assertEqual(decoded['text'], payload.text)
    self.assertEqual(decoded['fingerprint'], payload.fingerprint)
    with self.assertRaises(Exception):
      spread_v2.decode_fingerprint_logits(logits, 124)

  def test_haar_level2_roundtrip(self):
    rng = np.random.default_rng(7)
    arr = rng.normal(128.0, 30.0, size=(256, 320)).astype(np.float32)

    bands = spread_v2.dwt2_level2(arr)
    restored = spread_v2.idwt2_level2(bands)

    self.assertTrue(np.allclose(arr, restored, atol=1e-5))

  def test_embed_extract_clean_fingerprint(self):
    yy, xx = np.mgrid[0:640, 0:768].astype(np.float32)
    y = 128 + 45 * np.sin(xx / 19.0) + 35 * np.cos(yy / 23.0)
    img = cv2.merge([
      np.clip(y + 12 * np.sin(yy / 7.0), 0, 255).astype(np.uint8),
      np.clip(y + 18 * np.cos(xx / 11.0), 0, 255).astype(np.uint8),
      np.clip(y, 0, 255).astype(np.uint8),
    ])

    watermarked, diagnostics = spread_v2.embed_bgr(img, 'sample text', 123, 'light', 'fingerprint64')
    decoded = spread_v2.decode_bgr(watermarked, 123, 'light', 'fingerprint64')

    self.assertEqual(decoded['text'], f"fp:{diagnostics['fingerprint']}")
    self.assertGreater(decoded['confidence'], 0.45)


if __name__ == '__main__':
  unittest.main()
