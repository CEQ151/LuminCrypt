from __future__ import annotations

import zlib
from dataclasses import dataclass
from typing import Any

import numpy as np
import reedsolo

FRAME_VERSION = 1
ENGINE_NEURAL_ID = 1
MAX_TEXT_BYTES = 16
FRAME_BYTES = 24
RS_NSYM = 8
ENCODED_BYTES = FRAME_BYTES + RS_NSYM
PAYLOAD_BITS = ENCODED_BYTES * 8


@dataclass
class PayloadEnvelope:
  text: str
  text_bytes: bytes
  frame: bytes
  encoded: bytes
  bits: np.ndarray
  flags: int = 0


def _rs_codec() -> reedsolo.RSCodec:
  return reedsolo.RSCodec(RS_NSYM)


def bytes_to_bits(data: bytes) -> np.ndarray:
  out = np.zeros(len(data) * 8, dtype=np.float32)
  for i, b in enumerate(data):
    for j in range(8):
      out[i * 8 + j] = float((b >> (7 - j)) & 1)
  return out


def bits_to_bytes(bits: np.ndarray | list[float] | list[int]) -> bytes:
  flat = np.asarray(bits, dtype=np.float32).reshape(-1)
  if flat.size % 8 != 0:
    raise ValueError('bit array length must be divisible by 8')
  out = bytearray(flat.size // 8)
  for i in range(out.__len__()):
    value = 0
    for j in range(8):
      value = (value << 1) | int(flat[i * 8 + j] >= 0.5)
    out[i] = value
  return bytes(out)


def build_frame(payload_bytes: bytes, *, flags: int = 0) -> bytes:
  if len(payload_bytes) > MAX_TEXT_BYTES:
    raise ValueError(f'neural payload supports up to {MAX_TEXT_BYTES} UTF-8 bytes')
  header = bytes([
    FRAME_VERSION & 0xff,
    ENGINE_NEURAL_ID & 0xff,
    len(payload_bytes) & 0xff,
    flags & 0xff,
  ])
  crc = zlib.crc32(payload_bytes) & 0xffffffff
  crc_bytes = crc.to_bytes(4, 'big')
  padded = payload_bytes.ljust(MAX_TEXT_BYTES, b'\0')
  frame = header + crc_bytes + padded
  if len(frame) != FRAME_BYTES:
    raise AssertionError(f'unexpected frame length: {len(frame)}')
  return frame


def encode_frame(frame: bytes) -> bytes:
  if len(frame) != FRAME_BYTES:
    raise ValueError(f'frame must be exactly {FRAME_BYTES} bytes')
  return bytes(_rs_codec().encode(frame))


def encode_text_payload(text: str, *, flags: int = 0) -> PayloadEnvelope:
  payload_bytes = text.encode('utf-8')
  frame = build_frame(payload_bytes, flags=flags)
  encoded = encode_frame(frame)
  return PayloadEnvelope(
    text=text,
    text_bytes=payload_bytes,
    frame=frame,
    encoded=encoded,
    bits=bytes_to_bits(encoded),
    flags=flags,
  )


def decode_frame(encoded_bytes: bytes) -> dict[str, Any]:
  if len(encoded_bytes) != ENCODED_BYTES:
    raise ValueError(f'encoded payload must be {ENCODED_BYTES} bytes')
  decoded = _rs_codec().decode(encoded_bytes)
  frame = decoded[0] if isinstance(decoded, tuple) else decoded
  frame = bytes(frame)
  version, engine_id, length, flags = frame[0], frame[1], frame[2], frame[3]
  crc_expected = int.from_bytes(frame[4:8], 'big')
  payload = frame[8:24][:length]
  crc_actual = zlib.crc32(payload) & 0xffffffff
  if crc_actual != crc_expected:
    raise ValueError('payload CRC mismatch')
  text = payload.decode('utf-8', errors='strict')
  return {
    'version': version,
    'engineId': engine_id,
    'length': length,
    'flags': flags,
    'text': text,
    'payloadBytes': payload,
    'crc32': crc_actual,
    'frame': frame,
  }


def decode_payload_bits(bits: np.ndarray | list[float] | list[int]) -> dict[str, Any]:
  encoded = bits_to_bytes(bits)
  result = decode_frame(encoded)
  result['encoded'] = encoded
  return result


def decode_payload_logits(logits: np.ndarray) -> dict[str, Any]:
  logits = np.asarray(logits, dtype=np.float32).reshape(-1)
  if logits.size != PAYLOAD_BITS:
    raise ValueError(f'expected {PAYLOAD_BITS} logits, got {logits.size}')
  probs = 1.0 / (1.0 + np.exp(-logits))
  bits = (probs >= 0.5).astype(np.float32)
  decoded = decode_payload_bits(bits)
  decoded['probabilities'] = probs
  decoded['bitConfidence'] = float(np.mean(np.maximum(probs, 1.0 - probs)))
  return decoded
