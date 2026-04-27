import unittest

import numpy as np

from blind_watermark.mlwm.codec import (
  ENCODED_BYTES,
  MAX_TEXT_BYTES,
  bits_to_bytes,
  bytes_to_bits,
  decode_payload_bits,
  decode_payload_logits,
  encode_frame,
  encode_text_payload,
  unwhiten_payload_bits,
)
from blind_watermark.mlwm.metrics import decode_success_rate


class CodecTests(unittest.TestCase):
  def test_roundtrip_short_text(self):
    envelope = encode_text_payload('TRACE-42')
    decoded = decode_payload_bits(envelope.bits)
    self.assertEqual(decoded['text'], 'TRACE-42')
    self.assertEqual(len(envelope.encoded), ENCODED_BYTES)

  def test_password_protected_payload_roundtrip(self):
    envelope = encode_text_payload('LOCKED-42', password=2468)
    decoded = decode_payload_bits(envelope.bits, password=2468)
    self.assertEqual(decoded['text'], 'LOCKED-42')
    self.assertTrue(envelope.password_protected)
    self.assertTrue(decoded['passwordProtected'])

  def test_wrong_password_rejects_payload(self):
    envelope = encode_text_payload('LOCKED-42', password=2468)
    with self.assertRaises(Exception):
      decode_payload_bits(envelope.bits, password=2469)

  def test_different_passwords_produce_different_payload_bits(self):
    a = encode_text_payload('LOCKED-42', password=2468)
    b = encode_text_payload('LOCKED-42', password=2469)
    self.assertFalse(np.array_equal(a.bits, b.bits))

  def test_password_protected_logits_roundtrip(self):
    envelope = encode_text_payload('LOGITS-42', password=2468)
    logits = (envelope.bits * 2.0 - 1.0) * 8.0
    decoded = decode_payload_logits(logits, password=2468)
    self.assertEqual(decoded['text'], 'LOGITS-42')
    with self.assertRaises(Exception):
      decode_payload_logits(logits, password=2469)

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

  def test_decode_success_rate(self):
    envelope = encode_text_payload('OK-42')
    logits = (envelope.bits * 2.0 - 1.0) * 8.0
    self.assertEqual(decode_success_rate(logits.reshape(1, -1), ['OK-42']), 1.0)
    self.assertEqual(decode_success_rate(logits.reshape(1, -1), ['NOPE']), 0.0)


if __name__ == '__main__':
  unittest.main()
