import unittest

import numpy as np

from blind_watermark.mlwm.codec import ENCODED_BYTES, MAX_TEXT_BYTES, bits_to_bytes, decode_payload_bits, encode_text_payload


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
    rebuilt = bits_to_bytes(envelope.bits)
    self.assertEqual(rebuilt, envelope.encoded)
    self.assertTrue(np.array_equal(envelope.bits, envelope.bits.copy()))


if __name__ == '__main__':
  unittest.main()
