from __future__ import annotations

import hashlib
import math
import struct
import zlib
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
import reedsolo

BLOCK = 8
MODEL_VERSION = 'frequency-spread-v2'
PROTOCOL_FINGERPRINT64 = 'spread-v2-fingerprint64'
PROTOCOL_TEXT16 = 'spread-v2-text16'
PAYLOAD_MODE_FINGERPRINT64 = 'fingerprint64'
PAYLOAD_MODE_TEXT16 = 'text16'

FINGERPRINT_FRAME_BYTES = 16
FINGERPRINT_RS_NSYM = 8
FINGERPRINT_ENCODED_BYTES = FINGERPRINT_FRAME_BYTES + FINGERPRINT_RS_NSYM
FINGERPRINT_BITS = FINGERPRINT_ENCODED_BYTES * 8

DCT_PAIRS = [
  ((2, 3), (3, 2)),
  ((2, 4), (4, 2)),
  ((3, 3), (2, 5)),
  ((4, 3), (3, 4)),
]

PROFILES: dict[str, dict[str, float | int]] = {
  'trace': {
    'delta': 10.0,
    'reps': 5,
    'mask_floor': 0.55,
    'mask_gain': 1.20,
    'max_y_delta': 40.0,
  },
  'faint': {
    'delta': 11.0,
    'reps': 5,
    'mask_floor': 0.55,
    'mask_gain': 1.22,
    'max_y_delta': 40.0,
  },
  'light': {
    'delta': 12.0,
    'reps': 5,
    'mask_floor': 0.55,
    'mask_gain': 1.25,
    'max_y_delta': 40.0,
  },
  'balanced': {
    'delta': 14.0,
    'reps': 5,
    'mask_floor': 0.55,
    'mask_gain': 1.25,
    'max_y_delta': 45.0,
  },
}


@dataclass
class SpreadPayload:
  mode: str
  protocol: str
  bits: np.ndarray
  text: str
  fingerprint: str | None = None
  payload_bytes: int = 0


class SpreadV2DecodeError(Exception):
  def __init__(self, failure_code: str, message: str, *, confidence: float, attempts: list[dict[str, Any]] | None = None):
    super().__init__(message)
    self.failure_code = failure_code
    self.confidence = confidence
    self.attempts = attempts or []


def fingerprint_hex(text: str, password: int | None) -> str:
  normalized = int(password or 0) & 0xffffffff
  material = b'lc-fp-v1' + struct.pack('>I', normalized) + text.encode('utf-8')
  return hashlib.sha256(material).digest()[:8].hex()


def _seed(password: int | None, label: str) -> int:
  normalized = int(password or 0) & 0xffffffff
  digest = hashlib.sha256(label.encode('utf-8') + struct.pack('>I', normalized)).digest()
  return int.from_bytes(digest[:8], 'little')


def _bytes_to_bits(data: bytes) -> np.ndarray:
  out = np.zeros(len(data) * 8, dtype=np.float32)
  for i, b in enumerate(data):
    for j in range(8):
      out[i * 8 + j] = float((b >> (7 - j)) & 1)
  return out


def _bits_to_bytes(bits: np.ndarray | list[float] | list[int]) -> bytes:
  flat = np.asarray(bits, dtype=np.float32).reshape(-1)
  if flat.size % 8 != 0:
    raise ValueError('bit array length must be divisible by 8')
  out = bytearray(flat.size // 8)
  for i in range(len(out)):
    value = 0
    for j in range(8):
      value = (value << 1) | int(flat[i * 8 + j] >= 0.5)
    out[i] = value
  return bytes(out)


def _mask_bits(length: int, label: str, password: int | None = None) -> np.ndarray:
  seed = label.encode('utf-8')
  if password is not None:
    seed += struct.pack('>I', int(password) & 0xffffffff)
  stream = bytearray()
  counter = 0
  byte_len = math.ceil(length / 8)
  while len(stream) < byte_len:
    stream.extend(hashlib.sha256(seed + struct.pack('>I', counter)).digest())
    counter += 1
  return _bytes_to_bits(bytes(stream[:byte_len]))[:length]


def _xor_bits(bits: np.ndarray, mask: np.ndarray) -> np.ndarray:
  hard = (np.asarray(bits, dtype=np.float32).reshape(-1) >= 0.5).astype(np.float32)
  return np.abs(hard - mask.astype(np.float32)).astype(np.float32)


def _fingerprint_rs() -> reedsolo.RSCodec:
  return reedsolo.RSCodec(FINGERPRINT_RS_NSYM)


def _build_fingerprint_frame(fp_hex: str) -> bytes:
  fp = bytes.fromhex(fp_hex)
  if len(fp) != 8:
    raise ValueError('fingerprint must be 8 bytes')
  head = bytes([2, 1, 0, len(fp)])
  crc = zlib.crc32(head + fp) & 0xffffffff
  frame = head + fp + crc.to_bytes(4, 'big')
  if len(frame) != FINGERPRINT_FRAME_BYTES:
    raise AssertionError('unexpected fingerprint frame length')
  return frame


def encode_fingerprint_payload(text: str, password: int | None) -> SpreadPayload:
  fp = fingerprint_hex(text, password)
  frame = _build_fingerprint_frame(fp)
  encoded = bytes(_fingerprint_rs().encode(frame))
  bits = _bytes_to_bits(encoded)
  bits = _xor_bits(bits, _mask_bits(FINGERPRINT_BITS, 'spread-v2-whiten-fp'))
  bits = _xor_bits(bits, _mask_bits(FINGERPRINT_BITS, 'spread-v2-key-fp', password))
  return SpreadPayload(
    mode=PAYLOAD_MODE_FINGERPRINT64,
    protocol=PROTOCOL_FINGERPRINT64,
    bits=bits,
    text=f'fp:{fp}',
    fingerprint=fp,
    payload_bytes=8,
  )


def decode_fingerprint_logits(logits: np.ndarray, password: int | None) -> dict[str, Any]:
  logits = np.asarray(logits, dtype=np.float32).reshape(-1)
  if logits.size != FINGERPRINT_BITS:
    raise ValueError(f'expected {FINGERPRINT_BITS} fingerprint bits, got {logits.size}')
  key_mask = _mask_bits(FINGERPRINT_BITS, 'spread-v2-key-fp', password)
  logits = logits * np.where(key_mask >= 0.5, -1.0, 1.0).astype(np.float32)
  probs = 1.0 / (1.0 + np.exp(-logits))
  keyed_bits = (probs >= 0.5).astype(np.float32)
  raw_bits = _xor_bits(keyed_bits, _mask_bits(FINGERPRINT_BITS, 'spread-v2-whiten-fp'))
  encoded = _bits_to_bytes(raw_bits)
  decoded = _fingerprint_rs().decode(encoded)
  frame = bytes(decoded[0] if isinstance(decoded, tuple) else decoded)
  if len(frame) != FINGERPRINT_FRAME_BYTES:
    raise ValueError('fingerprint frame length mismatch')
  version, mode_id, _flags, fp_len = frame[0], frame[1], frame[2], frame[3]
  if version != 2 or mode_id != 1 or fp_len != 8:
    raise ValueError('unsupported fingerprint frame')
  crc_expected = int.from_bytes(frame[12:16], 'big')
  crc_actual = zlib.crc32(frame[:12]) & 0xffffffff
  if crc_actual != crc_expected:
    raise ValueError('fingerprint CRC mismatch')
  fp = frame[4:12].hex()
  confidence = float(np.mean(np.maximum(probs, 1.0 - probs)))
  return {
    'text': f'fp:{fp}',
    'fingerprint': fp,
    'payloadMode': PAYLOAD_MODE_FINGERPRINT64,
    'protocol': PROTOCOL_FINGERPRINT64,
    'payloadBytes': 8,
    'probabilities': probs,
    'bitConfidence': confidence,
    'berEstimate': float(np.mean(np.minimum(probs, 1.0 - probs))),
  }


def encode_text16_payload(text: str, password: int | None) -> SpreadPayload:
  try:
    from blind_watermark.mlwm.codec import encode_text_payload
  except ImportError:
    from mlwm.codec import encode_text_payload

  envelope = encode_text_payload(text, password=password)
  return SpreadPayload(
    mode=PAYLOAD_MODE_TEXT16,
    protocol=PROTOCOL_TEXT16,
    bits=envelope.bits,
    text=text,
    payload_bytes=len(envelope.text_bytes),
  )


def decode_text16_logits(logits: np.ndarray, password: int | None) -> dict[str, Any]:
  try:
    from blind_watermark.mlwm.codec import decode_payload_logits
  except ImportError:
    from mlwm.codec import decode_payload_logits

  decoded = decode_payload_logits(logits, password=password)
  decoded['payloadMode'] = PAYLOAD_MODE_TEXT16
  decoded['protocol'] = PROTOCOL_TEXT16
  decoded['berEstimate'] = float(
    np.mean(np.minimum(decoded['probabilities'], 1.0 - decoded['probabilities']))
  )
  return decoded


def build_payload(text: str, password: int | None, payload_mode: str = PAYLOAD_MODE_FINGERPRINT64) -> SpreadPayload:
  if payload_mode == PAYLOAD_MODE_TEXT16:
    return encode_text16_payload(text, password)
  return encode_fingerprint_payload(text, password)


def _haar_dwt_once(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
  even_h = arr.shape[0] - (arr.shape[0] % 2)
  even_w = arr.shape[1] - (arr.shape[1] % 2)
  work = arr[:even_h, :even_w].astype(np.float32)
  a = work[0::2, 0::2]
  b = work[0::2, 1::2]
  c = work[1::2, 0::2]
  d = work[1::2, 1::2]
  ll = (a + b + c + d) * 0.5
  hl = (a - b + c - d) * 0.5
  lh = (a + b - c - d) * 0.5
  hh = (a - b - c + d) * 0.5
  return ll, lh, hl, hh


def _haar_idwt_once(ll: np.ndarray, lh: np.ndarray, hl: np.ndarray, hh: np.ndarray) -> np.ndarray:
  out = np.zeros((ll.shape[0] * 2, ll.shape[1] * 2), dtype=np.float32)
  out[0::2, 0::2] = (ll + hl + lh + hh) * 0.5
  out[0::2, 1::2] = (ll - hl + lh - hh) * 0.5
  out[1::2, 0::2] = (ll + hl - lh - hh) * 0.5
  out[1::2, 1::2] = (ll - hl - lh + hh) * 0.5
  return out


def dwt2_level2(arr: np.ndarray) -> dict[str, np.ndarray]:
  ll1, lh1, hl1, hh1 = _haar_dwt_once(arr)
  ll2, lh2, hl2, hh2 = _haar_dwt_once(ll1)
  return {
    'll2': ll2,
    'lh2': lh2,
    'hl2': hl2,
    'hh2': hh2,
    'lh1': lh1,
    'hl1': hl1,
    'hh1': hh1,
  }


def idwt2_level2(bands: dict[str, np.ndarray]) -> np.ndarray:
  ll1 = _haar_idwt_once(bands['ll2'], bands['lh2'], bands['hl2'], bands['hh2'])
  return _haar_idwt_once(ll1, bands['lh1'], bands['hl1'], bands['hh1'])


def _trim_for_level2(y: np.ndarray) -> tuple[np.ndarray, int, int]:
  h = (y.shape[0] // 32) * 32
  w = (y.shape[1] // 32) * 32
  if h < 256 or w < 256:
    raise ValueError('image is too small for frequency-spread-v2 watermark')
  return y[:h, :w].astype(np.float32), h, w


def _subband_mask(y: np.ndarray, sub_shape: tuple[int, int]) -> np.ndarray:
  blur = cv2.GaussianBlur(y, (0, 0), 1.2)
  mean = cv2.boxFilter(blur, cv2.CV_32F, (15, 15), normalize=True)
  mean_sq = cv2.boxFilter(blur * blur, cv2.CV_32F, (15, 15), normalize=True)
  variance = np.maximum(mean_sq - mean * mean, 0.0)
  gx = cv2.Sobel(blur, cv2.CV_32F, 1, 0, ksize=3)
  gy = cv2.Sobel(blur, cv2.CV_32F, 0, 1, ksize=3)
  edge = np.sqrt(gx * gx + gy * gy)
  texture = np.log1p(variance) * 0.62 + np.log1p(edge) * 0.38
  brightness = np.clip(1.0 - np.abs(blur - 128.0) / 128.0, 0.0, 1.0)
  texture_small = cv2.resize(texture, (sub_shape[1], sub_shape[0]), interpolation=cv2.INTER_AREA)
  bright_small = cv2.resize(brightness, (sub_shape[1], sub_shape[0]), interpolation=cv2.INTER_AREA)
  hb, wb = sub_shape[0] // BLOCK, sub_shape[1] // BLOCK
  values: list[float] = []
  for by in range(hb):
    for bx in range(wb):
      y0, x0 = by * BLOCK, bx * BLOCK
      values.append(
        float(texture_small[y0:y0 + BLOCK, x0:x0 + BLOCK].mean())
        * (0.35 + 0.65 * float(bright_small[y0:y0 + BLOCK, x0:x0 + BLOCK].mean()))
      )
  mask = np.asarray(values, dtype=np.float32)
  lo, hi = float(np.percentile(mask, 20)), float(np.percentile(mask, 97))
  return np.clip((mask - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def _mapping(
  n_bits: int,
  total_positions: int,
  requested_reps: int,
  password: int | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, int]:
  reps = max(2, min(int(requested_reps), total_positions // n_bits))
  if reps < 2:
    raise ValueError('image is too small for frequency-spread-v2 payload')
  rng = np.random.default_rng(_seed(password, 'spread-v2-map'))
  carriers = rng.permutation(total_positions)[:n_bits * reps]
  bit_order = rng.permutation(n_bits)
  pair_indices = rng.integers(0, len(DCT_PAIRS), size=n_bits * reps)
  signs = rng.choice(np.asarray([-1.0, 1.0], dtype=np.float32), size=n_bits * reps)
  return carriers, bit_order, pair_indices, signs, reps


def _embed_band(
  bands: dict[str, np.ndarray],
  band_names: tuple[str, str],
  block_mask: np.ndarray,
  bits: np.ndarray,
  password: int | None,
  profile: dict[str, float | int],
) -> int:
  band_h, band_w = bands[band_names[0]].shape
  hb, wb = band_h // BLOCK, band_w // BLOCK
  positions_per_band = hb * wb
  total_positions = positions_per_band * len(band_names)
  carriers, bit_order, pair_indices, signs, reps = _mapping(
    len(bits), total_positions, int(profile['reps']), password
  )
  delta = float(profile['delta'])
  mask_floor = float(profile['mask_floor'])
  mask_gain = float(profile['mask_gain'])
  hard_bits = (np.asarray(bits, dtype=np.float32).reshape(-1) >= 0.5).astype(np.float32)

  for i, carrier in enumerate(carriers):
    bit_index = int(bit_order[i // reps])
    symbol = 1.0 if hard_bits[bit_index] >= 0.5 else -1.0
    signed_symbol = symbol * float(signs[i])
    band_index, block_index = divmod(int(carrier), positions_per_band)
    by, bx = divmod(block_index, wb)
    y0, x0 = by * BLOCK, bx * BLOCK
    band = bands[band_names[band_index]]
    dct_block = cv2.dct(band[y0:y0 + BLOCK, x0:x0 + BLOCK].astype(np.float32))
    coeff_a, coeff_b = DCT_PAIRS[int(pair_indices[i])]
    diff = float(dct_block[coeff_a] - dct_block[coeff_b])
    local_delta = delta * (mask_floor + mask_gain * float(block_mask[block_index]))
    if signed_symbol * diff < local_delta:
      change = (signed_symbol * local_delta - diff) * 0.5
      dct_block[coeff_a] += change
      dct_block[coeff_b] -= change
      band[y0:y0 + BLOCK, x0:x0 + BLOCK] = cv2.idct(dct_block)
  return reps


def _decode_band_logits(
  bands: dict[str, np.ndarray],
  band_names: tuple[str, str],
  n_bits: int,
  password: int | None,
  profile: dict[str, float | int],
) -> tuple[np.ndarray, float, int]:
  band_h, band_w = bands[band_names[0]].shape
  hb, wb = band_h // BLOCK, band_w // BLOCK
  positions_per_band = hb * wb
  total_positions = positions_per_band * len(band_names)
  carriers, bit_order, pair_indices, signs, reps = _mapping(
    n_bits, total_positions, int(profile['reps']), password
  )
  delta = float(profile['delta'])
  scores: list[list[float]] = [[] for _ in range(n_bits)]
  for i, carrier in enumerate(carriers):
    bit_index = int(bit_order[i // reps])
    band_index, block_index = divmod(int(carrier), positions_per_band)
    by, bx = divmod(block_index, wb)
    y0, x0 = by * BLOCK, bx * BLOCK
    band = bands[band_names[band_index]]
    dct_block = cv2.dct(band[y0:y0 + BLOCK, x0:x0 + BLOCK].astype(np.float32))
    coeff_a, coeff_b = DCT_PAIRS[int(pair_indices[i])]
    diff = float(dct_block[coeff_a] - dct_block[coeff_b])
    scores[bit_index].append(float(signs[i]) * math.tanh(diff / max(delta * 0.9, 1e-6)))
  logits = np.zeros(n_bits, dtype=np.float32)
  confidence_samples = np.zeros(n_bits, dtype=np.float32)
  for bit_index, bit_scores in enumerate(scores):
    score = float(np.mean(bit_scores)) if bit_scores else 0.0
    logits[bit_index] = score * 5.0
    confidence_samples[bit_index] = abs(score)
  return logits, float(np.mean(confidence_samples)), reps


def embed_bgr(
  base_bgr: np.ndarray,
  text: str,
  password: int | None,
  quality: str,
  payload_mode: str = PAYLOAD_MODE_FINGERPRINT64,
) -> tuple[np.ndarray, dict[str, Any]]:
  profile_name = quality if quality in PROFILES else 'light'
  profile = PROFILES[profile_name]
  payload = build_payload(text, password, payload_mode)
  ycc = cv2.cvtColor(base_bgr[:, :, :3], cv2.COLOR_BGR2YCrCb)
  y = ycc[:, :, 0].astype(np.float32)
  work, hh, ww = _trim_for_level2(y)
  bands = dwt2_level2(work)
  band_names = ('lh2', 'hl2')
  block_mask = _subband_mask(work, bands[band_names[0]].shape)
  reps = _embed_band(bands, band_names, block_mask, payload.bits, password, profile)
  reconstructed = idwt2_level2(bands)
  diff = np.clip(
    reconstructed - work,
    -float(profile['max_y_delta']),
    float(profile['max_y_delta']),
  )
  out = ycc.copy()
  out_y = y.copy()
  out_y[:hh, :ww] = np.clip(np.round(work + diff), 0, 255)
  out[:, :, 0] = out_y.astype(np.uint8)
  out_bgr = cv2.cvtColor(out, cv2.COLOR_YCrCb2BGR)
  return out_bgr, {
    'codec': MODEL_VERSION,
    'protocol': payload.protocol,
    'payloadMode': payload.mode,
    'fingerprint': payload.fingerprint,
    'payloadBytes': payload.payload_bytes,
    'spreadDelta': float(profile['delta']),
    'spreadReps': int(reps),
    'spreadMaskFloor': float(profile['mask_floor']),
    'spreadMaskGain': float(profile['mask_gain']),
    'spreadBlocks': int((bands[band_names[0]].shape[0] // BLOCK) * (bands[band_names[0]].shape[1] // BLOCK) * 2),
    'modelVersion': MODEL_VERSION,
  }


def decode_bgr(
  base_bgr: np.ndarray,
  password: int | None,
  quality: str,
  payload_mode: str = PAYLOAD_MODE_FINGERPRINT64,
) -> dict[str, Any]:
  profile_name = quality if quality in PROFILES else 'light'
  profile = PROFILES[profile_name]
  ycc = cv2.cvtColor(base_bgr[:, :, :3], cv2.COLOR_BGR2YCrCb)
  work, _hh, _ww = _trim_for_level2(ycc[:, :, 0].astype(np.float32))
  bands = dwt2_level2(work)
  if payload_mode == PAYLOAD_MODE_TEXT16:
    try:
      from blind_watermark.mlwm.codec import PAYLOAD_BITS
    except ImportError:
      from mlwm.codec import PAYLOAD_BITS

    logits, confidence, reps = _decode_band_logits(bands, ('lh2', 'hl2'), PAYLOAD_BITS, password, profile)
    try:
      decoded = decode_text16_logits(logits, password)
    except Exception as exc:
      code = 'wrong_password_or_corrupted_payload' if confidence >= 0.48 else 'no_signal'
      raise SpreadV2DecodeError(
        code,
        'frequency-spread-v2 text16 payload checksum failed' if code != 'no_signal' else 'no reliable frequency-spread-v2 signal',
        confidence=confidence,
        attempts=[{'payloadMode': payload_mode, 'profile': profile_name, 'confidence': confidence}],
      ) from exc
  else:
    logits, confidence, reps = _decode_band_logits(bands, ('lh2', 'hl2'), FINGERPRINT_BITS, password, profile)
    try:
      decoded = decode_fingerprint_logits(logits, password)
    except Exception as exc:
      code = 'wrong_password_or_corrupted_payload' if confidence >= 0.48 else 'no_signal'
      raise SpreadV2DecodeError(
        code,
        'frequency-spread-v2 fingerprint payload checksum failed' if code != 'no_signal' else 'no reliable frequency-spread-v2 signal',
        confidence=confidence,
        attempts=[{'payloadMode': payload_mode, 'profile': profile_name, 'confidence': confidence}],
      ) from exc
  decoded['confidence'] = confidence
  decoded['spreadReps'] = reps
  decoded['spreadDelta'] = float(profile['delta'])
  decoded['strategy'] = 'dwt2-dct-spread-spectrum'
  decoded['modelVersion'] = MODEL_VERSION
  return decoded
