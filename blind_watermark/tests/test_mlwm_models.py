import unittest

from blind_watermark.mlwm.codec import PAYLOAD_BITS

try:
  import torch

  from blind_watermark.mlwm.models import build_models
except ImportError:  # pragma: no cover
  torch = None
  build_models = None


@unittest.skipIf(torch is None, 'PyTorch is not installed')
class ModelTests(unittest.TestCase):
  def test_decoder_outputs_payload_grid(self):
    _, decoder = build_models(payload_bits=PAYLOAD_BITS)
    image = torch.rand(2, 3, 128, 128)
    logits, confidence = decoder(image)
    self.assertEqual(tuple(logits.shape), (2, PAYLOAD_BITS))
    self.assertEqual(tuple(confidence.shape), (2, 1))

  def test_encoder_decoder_roundtrip_shapes(self):
    encoder, decoder = build_models(payload_bits=PAYLOAD_BITS)
    image = torch.rand(2, 3, 128, 128)
    bits = torch.randint(0, 2, (2, PAYLOAD_BITS)).float()
    residual = encoder(image, bits)
    logits, confidence = decoder(torch.clamp(image + residual, 0.0, 1.0))
    self.assertEqual(tuple(residual.shape), tuple(image.shape))
    self.assertEqual(tuple(logits.shape), (2, PAYLOAD_BITS))
    self.assertEqual(tuple(confidence.shape), (2, 1))


if __name__ == '__main__':
  unittest.main()
