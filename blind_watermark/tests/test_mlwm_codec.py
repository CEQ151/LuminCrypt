import unittest

import numpy as np

from blind_watermark.mlwm.codec import (
  ENCODED_BYTES,
  MAX_TEXT_BYTES,
  bits_to_bytes,
  bytes_to_bits,
  decode_payload_bits,
  encode_frame,
  encode_text_payload,
  unwhiten_payload_bits,
)


class CodecTests(unittest.TestCase):
  def test_roundtrip_short_text(self):
    envelope = encode_text_payload('TRACE-42')
    decoded = decode_payload_bits(envelope.bits)
    self.assertEqual(decoded['text'], 'TRACE-42')
    self.assertEqual(len(envelope.encoded), ENCODED_BYTES)

  def test_reject_long_text(self):
    with self.assertRaises(ValueError):
      encode_text_payload('X' * (MAX_TEXT_BYTES + 1))

  def test_bits_to_bytes_roundtrip(self):
    envelope = encode_text_payload('HELLO')
    rebuilt = bits_to_bytes(unwhiten_payload_bits(envelope.bits))
    self.assertEqual(rebuilt, envelope.encoded)
    self.assertTrue(np.array_equal(envelope.bits, envelope.bits.copy()))

  def test_payload_bits_are_whitened(self):
    samples = [encode_text_payload(f'TRACE-{i:04d}').bits for i in range(1000)]
    mean_ones = float(np.stack(samples).mean())
    self.assertGreater(mean_ones, 0.45)
    self.assertLess(mean_ones, 0.55)

  def test_whitening_is_reversible(self):
    envelope = encode_text_payload('ROUNDTRIP')
    raw_bits = unwhiten_payload_bits(envelope.bits)
    self.assertEqual(bits_to_bytes(raw_bits), envelope.encoded)
    self.assertTrue(np.array_equal(bytes_to_bits(encode_frame(envelope.frame)), raw_bits))


if __name__ == '__main__':
  unittest.main()
