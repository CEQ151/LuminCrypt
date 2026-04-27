#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rwm_engine.py  —  Robust Watermark Engine v3
=============================================
Block-DCT quantization watermark with DFT log-polar synchronisation template
for geometric-attack resilience.

v3 upgrades over v2:
  - Adaptive RS_NSYM and REDUNDANCY per quality preset
  - Edge-margin block exclusion to resist platform watermark overlays
  - Multi-scale embedding (0.75x, 0.5x) for resolution-reduction resilience
  - Dual-ring synchronization template for stronger geometric recovery
  - Self-check after embed with automatic quality escalation

Architecture
------------
1. **Synchronization template** – additive peaks injected into the DFT
   magnitude spectrum of the grayscale channel.  Detected via log-polar
   cross-correlation to estimate rotation angle & scale factor.
2. **Payload** – encoded with Reed-Solomon ECC, then embedded by quantising
   selected mid-frequency DCT coefficients inside 8×8 blocks.  Each bit is
   redundantly embedded into multiple blocks (majority-vote on extraction).
3. The spatial-domain perturbation is spread across all three BGR channels
   so that the grayscale (which is a weighted sum of BGR) roundtrips through
   uint8 with minimal quantisation error.
4. Multi-scale embedding duplicates the payload at 0.75x and 0.5x
   downsampled resolutions for resilience against platform downsizing.

Dependencies: numpy, opencv-python, scipy, reedsolo
"""

import os
import numpy as np
import cv2
from scipy.fft import fft2, ifft2, fftshift, ifftshift
import reedsolo
import hashlib
import struct

# ─── Constants ────────────────────────────────────────────────────────────────

BLOCK = 8
DCT_COEFF_IDX = [(0, 1), (1, 0), (0, 2), (2, 0), (1, 1)]  # mid-freq zigzag
HEADER_BITS = 16        # encode payload bit-length as 16-bit unsigned

QUALITY = {
    'invisible': {
        'delta': 8,
        'template_strength': 0.003,
        'rs_nsym': 16,
        'redundancy': 2,
        'margin_ratio': 0.05,
        'template_peaks': 64,
        'scales': [1.0],
    },
    'balanced': {
        'delta': 18,
        'template_strength': 0.006,
        'rs_nsym': 24,
        'redundancy': 3,
        'margin_ratio': 0.10,
        'template_peaks': 96,
        'scales': [1.0, 0.75],
    },
    'robust': {
        'delta': 35,
        'template_strength': 0.012,
        'rs_nsym': 32,
        'redundancy': 5,
        'margin_ratio': 0.15,
        'template_peaks': 128,
        'scales': [1.0, 0.75, 0.5],
    },
}

TEMPLATE_RING_BANDS = [
    (0.15, 0.40),
    (0.45, 0.65),
]

# v2 compat constants
_V2_RS_NSYM = 20
_V2_REDUNDANCY = 3
RWM_VERSION = '3.2.0'
NEURAL_MAX_TEXT_BYTES = 16
NEURAL_PROFILES = {
    'invisible': {
        'residual_strength': 0.35,
        'template_strength': 0.0,
        'template_peaks': 0,
        'sync_enabled': False,
    },
    'balanced': {
        'residual_strength': 0.55,
        'template_strength': 0.0,
        'template_peaks': 0,
        'sync_enabled': False,
    },
    'robust': {
        'residual_strength': 1.0,
        'template_strength': 0.0,
        'template_peaks': 0,
        'sync_enabled': False,
    },
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _seed(password: int) -> int:
    return int.from_bytes(
        hashlib.sha256(struct.pack('>I', password & 0xFFFFFFFF)).digest()[:4], 'big')


def _text_to_bits(text: str, rs_nsym: int = 20) -> np.ndarray:
    raw = text.encode('utf-8')
    rs = reedsolo.RSCodec(rs_nsym)
    enc = bytes(rs.encode(raw))
    header = struct.pack('>H', len(raw))
    blob = header + enc
    bits = []
    for b in blob:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    return np.array(bits, dtype=np.int32)


def _bits_to_text(bits: np.ndarray, rs_nsym: int = 20) -> str:
    n = len(bits) // 8
    if n < 2:
        raise ValueError('too few bits')
    ba = bytearray()
    for i in range(n):
        v = 0
        for j in range(8):
            v = (v << 1) | int(bits[i * 8 + j] > 0.5)
        ba.append(v)
    raw_len = struct.unpack('>H', bytes(ba[:2]))[0]
    enc = bytes(ba[2:])
    rs = reedsolo.RSCodec(rs_nsym)
    decoded = rs.decode(enc)
    if isinstance(decoded, tuple):
        decoded = decoded[0]
    dec = bytes(decoded)
    return dec[:raw_len].decode('utf-8', errors='replace')


def _build_radius_map(h, w):
    cy, cx = h // 2, w // 2
    y = np.arange(h) - cy
    x = np.arange(w) - cx
    yy, xx = np.meshgrid(y, x, indexing='ij')
    r = np.sqrt(yy**2 + xx**2)
    return r / (np.sqrt(cy**2 + cx**2) + 1e-10)


# ─── Synchronisation template (dual-ring) ────────────────────────────────────

def _make_template(h, w, seed, num_peaks=64):
    pat = np.zeros((h, w), dtype=np.float64)
    rng = np.random.RandomState(seed)
    r = _build_radius_map(h, w)

    peaks_per_band = max(4, num_peaks // len(TEMPLATE_RING_BANDS))
    cy, cx = h // 2, w // 2

    for ring_min, ring_max in TEMPLATE_RING_BANDS:
        mask = (r >= ring_min) & (r <= ring_max)
        idx = np.argwhere(mask)
        if len(idx) == 0:
            continue
        n = min(peaks_per_band, len(idx) // 2)
        chosen = rng.choice(len(idx), size=n, replace=False)
        for c in chosen:
            y, x = idx[c]
            pat[y, x] = 1.0
            sy, sx = 2 * cy - y, 2 * cx - x
            if 0 <= sy < h and 0 <= sx < w:
                pat[sy, sx] = 1.0
    return pat


def _embed_template(gray, seed, strength, num_peaks=64):
    h, w = gray.shape
    G = fftshift(fft2(gray))
    tmpl = _make_template(h, w, seed, num_peaks)
    avg = np.mean(np.abs(G)[np.abs(G) > 0])
    G[tmpl > 0] += strength * avg
    return np.real(ifft2(ifftshift(G)))


def _detect_transform(gray, seed, num_peaks=64):
    h, w = gray.shape
    G = fftshift(fft2(gray))
    mag = np.log1p(np.abs(G))
    ref = _make_template(h, w, seed, num_peaks).astype(np.float64)

    cy, cx = h // 2, w // 2
    max_r = min(cy, cx) * 0.9
    na, nr = 360, 256
    lr_min, lr_max = np.log(2.0), np.log(max_r)
    radii = np.exp(np.linspace(lr_min, lr_max, nr))
    angles = np.linspace(0, 2 * np.pi, na, endpoint=False)
    aa, rr = np.meshgrid(angles, radii, indexing='ij')
    my = (cy + rr * np.sin(aa)).astype(np.float32)
    mx = (cx + rr * np.cos(aa)).astype(np.float32)

    m_lp = cv2.remap(mag.astype(np.float32), mx, my, cv2.INTER_LINEAR,
                      borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    r_lp = cv2.remap(ref.astype(np.float32), mx, my, cv2.INTER_LINEAR,
                      borderMode=cv2.BORDER_CONSTANT, borderValue=0)

    m_lp /= (np.std(m_lp) + 1e-10)
    r_lp /= (np.std(r_lp) + 1e-10)
    cc = fft2(m_lp) * np.conj(fft2(r_lp))
    cc /= (np.abs(cc) + 1e-10)
    corr = np.real(ifft2(cc))
    pk = np.unravel_index(np.argmax(corr), corr.shape)
    conf = corr[pk] / (np.std(corr) + 1e-10)

    a_shift = pk[0]
    if a_shift > na // 2:
        a_shift -= na
    angle = a_shift * (360.0 / na)

    s_shift = pk[1]
    if s_shift > nr // 2:
        s_shift -= nr
    scale = np.exp(s_shift * (lr_max - lr_min) / nr)

    return angle, scale, float(conf)


# ─── Block-DCT payload ───────────────────────────────────────────────────────

def _block_positions(h, w, n_blocks, seed, margin_ratio=0.0):
    """Return deterministic list of (row, col) top-left corners of 8×8 blocks,
    excluding edge margin regions where platform watermarks are typically placed."""
    rows = h // BLOCK
    cols = w // BLOCK

    if margin_ratio > 0:
        margin_r = max(1, int(rows * margin_ratio))
        margin_c = max(1, int(cols * margin_ratio))
        candidates = []
        for r in range(margin_r, rows - margin_r):
            for c_idx in range(margin_c, cols - margin_c):
                candidates.append(r * cols + c_idx)
        total = len(candidates)
        if total < n_blocks:
            raise ValueError(
                f'Image too small with margin={margin_ratio}: '
                f'need {n_blocks} blocks, have {total} (try reducing margin or using a larger image)')
        rng = np.random.RandomState(seed)
        chosen = rng.choice(total, size=n_blocks, replace=False)
        return [(int(candidates[c] // cols) * BLOCK,
                 int(candidates[c] % cols) * BLOCK) for c in chosen]
    else:
        total = rows * cols
        if total < n_blocks:
            raise ValueError(f'Image too small: need {n_blocks} blocks, have {total}')
        rng = np.random.RandomState(seed)
        chosen = rng.choice(total, size=n_blocks, replace=False)
        return [(int(c // cols) * BLOCK, int(c % cols) * BLOCK) for c in chosen]


def _embed_bits_dct(gray, bits, delta, seed, redundancy=3, margin_ratio=0.0):
    n_bits = len(bits)
    n_blocks = n_bits * redundancy
    h, w = gray.shape
    positions = _block_positions(h, w, n_blocks, seed, margin_ratio)
    out = gray.copy()

    for i in range(n_bits):
        b = int(bits[i])
        for r in range(redundancy):
            br, bc = positions[i * redundancy + r]
            block = out[br:br + BLOCK, bc:bc + BLOCK].copy()
            dct_block = cv2.dct(block.astype(np.float64))

            for ci, cj in DCT_COEFF_IDX:
                v = dct_block[ci, cj]
                q = np.floor(v / delta)
                if int(q) % 2 != b:
                    q = q + 1 if v >= q * delta + delta / 2 else q - 1
                dct_block[ci, cj] = q * delta + delta / 2

            out[br:br + BLOCK, bc:bc + BLOCK] = cv2.idct(dct_block)

    return out


def _extract_bits_dct(gray, n_bits, delta, seed, redundancy=3, margin_ratio=0.0):
    n_blocks = n_bits * redundancy
    h, w = gray.shape
    positions = _block_positions(h, w, n_blocks, seed, margin_ratio)
    bits = np.zeros(n_bits, dtype=np.float64)

    for i in range(n_bits):
        votes = 0
        for r in range(redundancy):
            br, bc = positions[i * redundancy + r]
            block = gray[br:br + BLOCK, bc:bc + BLOCK].astype(np.float64)
            dct_block = cv2.dct(block)

            sub_votes = 0
            for ci, cj in DCT_COEFF_IDX:
                v = dct_block[ci, cj]
                q = int(np.floor(v / delta))
                sub_votes += q % 2
            votes += (1 if sub_votes > len(DCT_COEFF_IDX) / 2 else 0)

        bits[i] = 1.0 if votes > redundancy / 2 else 0.0

    return bits


# ─── Single-scale embed/extract helpers ──────────────────────────────────────

def _embed_single_scale(gray, all_bits, delta, seed, redundancy, margin_ratio,
                        template_strength, num_peaks):
    gray_t = _embed_template(gray, seed, template_strength, num_peaks)
    gray_wm = _embed_bits_dct(gray_t, all_bits, delta, seed + 1,
                               redundancy, margin_ratio)
    return gray_wm


def _try_extract_single(gray, sd, quality_name, rs_nsym, redundancy, margin_ratio, num_peaks):
    """Try extraction at a single scale with specific parameters.
    Returns text on success, None on failure."""
    h, w = gray.shape
    cfg = QUALITY[quality_name]
    delta = cfg['delta']

    try:
        hdr_bits = _extract_bits_dct(gray, HEADER_BITS, delta, sd + 1,
                                      redundancy, margin_ratio)
        n_payload = 0
        for i in range(HEADER_BITS):
            n_payload = (n_payload << 1) | int(hdr_bits[i] > 0.5)

        max_blocks = _count_available_blocks(h, w, margin_ratio)
        max_bits = max_blocks // redundancy - HEADER_BITS
        if n_payload <= 0 or n_payload > max_bits:
            return None

        all_bits = _extract_bits_dct(gray, HEADER_BITS + n_payload, delta, sd + 1,
                                      redundancy, margin_ratio)
        return _bits_to_text(all_bits[HEADER_BITS:], rs_nsym)
    except Exception:
        return None


def _count_available_blocks(h, w, margin_ratio):
    rows = h // BLOCK
    cols = w // BLOCK
    if margin_ratio > 0:
        mr = max(1, int(rows * margin_ratio))
        mc = max(1, int(cols * margin_ratio))
        return (rows - 2 * mr) * (cols - 2 * mc)
    return rows * cols


# ─── Public API ───────────────────────────────────────────────────────────────

def embed_watermark_legacy(img, text, password=1, quality='balanced', self_check=True):
    if quality not in QUALITY:
        raise ValueError(f'quality must be one of {list(QUALITY.keys())}')
    cfg = QUALITY[quality]
    delta = cfg['delta']
    t_str = cfg['template_strength']
    rs_nsym = cfg['rs_nsym']
    redundancy = cfg['redundancy']
    margin_ratio = cfg['margin_ratio']
    num_peaks = cfg['template_peaks']
    scales = cfg['scales']

    payload = _text_to_bits(text, rs_nsym)
    n_payload = len(payload)

    hdr = np.zeros(HEADER_BITS, dtype=np.int32)
    for i in range(HEADER_BITS):
        hdr[i] = (n_payload >> (HEADER_BITS - 1 - i)) & 1
    all_bits = np.concatenate([hdr, payload])

    alpha = img[:, :, 3].copy() if img.ndim == 3 and img.shape[2] == 4 else None
    if alpha is not None:
        img = img[:, :, :3]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
    sd = _seed(password)
    h, w = gray.shape

    # Primary scale (1.0x) embedding
    gray_wm = _embed_single_scale(gray, all_bits, delta, sd, redundancy,
                                   margin_ratio, t_str, num_peaks)
    total_diff = gray_wm - gray

    # Multi-scale embedding for resolution-reduction resilience
    for i, scale in enumerate(scales):
        if scale >= 1.0:
            continue
        sh, sw = int(h * scale), int(w * scale)
        if sh < BLOCK * 4 or sw < BLOCK * 4:
            continue
        gray_down = cv2.resize(gray, (sw, sh), interpolation=cv2.INTER_AREA)
        seed_offset = (i + 1) * 10
        try:
            gray_down_wm = _embed_single_scale(
                gray_down, all_bits, delta, sd + seed_offset,
                redundancy, margin_ratio, t_str * 0.8, num_peaks)
            diff_down = gray_down_wm - gray_down
            diff_up = cv2.resize(diff_down, (w, h), interpolation=cv2.INTER_LINEAR)
            total_diff += diff_up * 0.6
        except ValueError:
            continue

    out = img.astype(np.float64)
    for c in range(3):
        out[:, :, c] += total_diff
    out = np.clip(np.round(out), 0, 255).astype(np.uint8)

    if alpha is not None:
        out = cv2.merge([out, alpha])

    # Self-check: verify watermark can be extracted from the output
    if self_check:
        try:
            extracted = extract_watermark_legacy(out, password, quality)
            if extracted != text:
                raise ValueError('self-check mismatch')
        except Exception:
            quality_order = ['invisible', 'balanced', 'robust']
            current_idx = quality_order.index(quality)
            if current_idx < len(quality_order) - 1:
                upgraded = quality_order[current_idx + 1]
                return embed_watermark_legacy(img if alpha is None else cv2.merge([img, alpha]),
                                              text, password, upgraded, self_check=False)

    return out


def extract_watermark_legacy(img, password=1, quality='balanced'):
    if quality not in QUALITY:
        quality = 'balanced'

    if img.ndim == 3 and img.shape[2] == 4:
        img = img[:, :, :3]

    gray_orig = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float64)
    h, w = gray_orig.shape
    sd = _seed(password)

    def _try_all_presets(gray_ch, preset_order=None):
        """Try extraction with all quality presets and both v3 and v2 parameters."""
        if preset_order is None:
            preset_order = [quality] + [q for q in QUALITY if q != quality]

        for q in preset_order:
            qcfg = QUALITY[q]
            # v3 parameters (adaptive RS/redundancy/margin)
            result = _try_extract_single(
                gray_ch, sd, q,
                qcfg['rs_nsym'], qcfg['redundancy'], qcfg['margin_ratio'],
                qcfg['template_peaks'])
            if result is not None:
                return result

            # v2 compat: try old fixed parameters (RS_NSYM=20, REDUNDANCY=3, no margin)
            result = _try_extract_single(
                gray_ch, sd, q,
                _V2_RS_NSYM, _V2_REDUNDANCY, 0.0, 64)
            if result is not None:
                return result

        return None

    # 1. Try extraction at original resolution
    result = _try_all_presets(gray_orig)
    if result is not None:
        return result

    # 2. Try multi-scale extraction (for images that were downscaled by platforms)
    all_scales = set()
    for q in QUALITY:
        for s in QUALITY[q]['scales']:
            if s < 1.0:
                all_scales.add(s)

    for scale in sorted(all_scales, reverse=True):
        sh, sw = int(h * scale), int(w * scale)
        if sh < BLOCK * 4 or sw < BLOCK * 4:
            continue
        gray_scaled = cv2.resize(gray_orig, (sw, sh), interpolation=cv2.INTER_AREA)
        for i, s in enumerate(sorted(all_scales, reverse=True)):
            if abs(s - scale) > 0.01:
                continue
            seed_offset = (i + 1) * 10
            sd_scaled = sd + seed_offset
            for q in [quality] + [qq for qq in QUALITY if qq != quality]:
                qcfg = QUALITY[q]
                result = _try_extract_single_with_seed(
                    gray_scaled, sd_scaled, q,
                    qcfg['rs_nsym'], qcfg['redundancy'], qcfg['margin_ratio'],
                    qcfg['template_peaks'])
                if result is not None:
                    return result

    # 3. Try with geometric correction
    for num_peaks in [128, 96, 64]:
        angle, scale, conf = _detect_transform(gray_orig, sd, num_peaks)
        if conf > 5.0 and (abs(angle) > 0.5 or abs(scale - 1.0) > 0.02):
            M = cv2.getRotationMatrix2D((w / 2, h / 2), -angle, 1.0 / scale)
            corrected = cv2.warpAffine(img, M, (w, h),
                                       flags=cv2.INTER_LINEAR,
                                       borderMode=cv2.BORDER_REFLECT)
            gray_corrected = cv2.cvtColor(corrected, cv2.COLOR_BGR2GRAY).astype(np.float64)
            result = _try_all_presets(gray_corrected)
            if result is not None:
                return result

    raise ValueError('No valid watermark found in image')


def _resolve_neural_profile(quality):
    if quality in NEURAL_PROFILES:
        return quality
    return 'balanced'


def _center_square(image):
    h, w = image.shape[:2]
    edge = min(h, w)
    y0 = max(0, (h - edge) // 2)
    x0 = max(0, (w - edge) // 2)
    return image[y0:y0 + edge, x0:x0 + edge]


def _rectify_neural_image(img, password):
    gray_orig = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY).astype(np.float64)
    h, w = gray_orig.shape
    sd = _seed(password)
    best = {'angle': 0.0, 'scale': 1.0, 'confidence': 0.0, 'peaks': 64}
    for num_peaks in [128, 96, 64]:
        angle, scale, conf = _detect_transform(gray_orig, sd, num_peaks)
        if conf > best['confidence']:
            best = {'angle': float(angle), 'scale': float(scale), 'confidence': float(conf), 'peaks': int(num_peaks)}
    corrected = img[:, :, :3]
    if best['confidence'] > 4.0 and (abs(best['angle']) > 0.2 or abs(best['scale'] - 1.0) > 0.01):
        matrix = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), -best['angle'], 1.0 / max(best['scale'], 1e-3))
        corrected = cv2.warpAffine(corrected, matrix, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    return corrected, best


def _build_neural_views(corrected):
    rgb = cv2.cvtColor(corrected[:, :, :3], cv2.COLOR_BGR2RGB)
    center_crop = _center_square(rgb)
    center_crop = cv2.resize(center_crop, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    padded = cv2.copyMakeBorder(rgb, 24, 24, 24, 24, borderType=cv2.BORDER_REFLECT)
    padded = cv2.resize(padded, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC)
    return [rgb, center_crop, padded]


def _legacy_embed_response(image, quality, requested_engine, fallback_reason=None):
    diagnostics = {
        'quality': quality,
        'fallbackReason': fallback_reason,
    }
    return {
        'ok': True,
        'image': image,
        'engine_used': 'legacy',
        'fallback_used': requested_engine != 'legacy',
        'quality_used': quality,
        'confidence': 1.0,
        'diagnostics': diagnostics,
    }


def _legacy_extract_response(text, quality, requested_engine, fallback_reason=None):
    diagnostics = {
        'quality': quality,
        'fallbackReason': fallback_reason,
    }
    return {
        'ok': True,
        'wm': text,
        'engine_used': 'legacy',
        'fallback_used': requested_engine != 'legacy',
        'confidence': 1.0,
        'diagnostics': diagnostics,
    }


def _neural_embed_impl(img, text, password=1, quality='balanced', models_dir=None, self_check=True):
    if len(text.encode('utf-8')) > NEURAL_MAX_TEXT_BYTES:
        raise ValueError(f'Neural watermark supports up to {NEURAL_MAX_TEXT_BYTES} UTF-8 bytes')
    try:
        from blind_watermark.mlwm.codec import encode_text_payload
        from blind_watermark.mlwm.infer import NeuralRuntimeUnavailable, neural_encode_residual, apply_neural_residual
    except ImportError:
        from mlwm.codec import encode_text_payload
        from mlwm.infer import NeuralRuntimeUnavailable, neural_encode_residual, apply_neural_residual

    profile_name = _resolve_neural_profile(quality)
    profile = NEURAL_PROFILES[profile_name]
    alpha = img[:, :, 3].copy() if img.ndim == 3 and img.shape[2] == 4 else None
    base = img[:, :, :3] if alpha is not None else img.copy()
    payload = encode_text_payload(text, password=password)
    rgb = cv2.cvtColor(base, cv2.COLOR_BGR2RGB)
    try:
        encoded = neural_encode_residual(rgb, payload.bits, models_dir=models_dir, use_cuda=False)
    except NeuralRuntimeUnavailable:
        raise
    rgb_watermarked = apply_neural_residual(rgb, encoded['residual'], strength=profile['residual_strength'])
    out = cv2.cvtColor(rgb_watermarked, cv2.COLOR_RGB2BGR).astype(np.float64)

    if profile.get('sync_enabled', False) and profile.get('template_strength', 0.0) > 0.0:
        gray = cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float64)
        gray_sync = _embed_template(gray, _seed(password), profile['template_strength'], profile['template_peaks'])
        total_diff = gray_sync - gray
        for c in range(3):
            out[:, :, c] += total_diff
    out = np.clip(np.round(out), 0, 255).astype(np.uint8)

    if alpha is not None:
        out = cv2.merge([out, alpha])

    diagnostics = {
        'profile': profile_name,
        'protocol': payload.protocol,
        'passwordProtected': payload.password_protected,
        'visualStrength': profile['residual_strength'],
        'payloadBytes': len(payload.text_bytes),
        'modelVersion': encoded.get('modelVersion'),
        'modelsDir': models_dir,
    }

    if self_check:
        extracted = _neural_extract_impl(out, password=password, quality=quality, models_dir=models_dir)
        if not extracted.get('ok') or extracted.get('wm') != text:
            raise ValueError('Neural self-check mismatch')

    return {
        'ok': True,
        'image': out,
        'engine_used': 'neural',
        'fallback_used': False,
        'quality_used': profile_name,
        'confidence': 1.0,
        'diagnostics': diagnostics,
    }


def _neural_extract_impl(img, password=1, quality='balanced', models_dir=None):
    try:
        from blind_watermark.mlwm.infer import NeuralRuntimeUnavailable, neural_decode_views
    except ImportError:
        from mlwm.infer import NeuralRuntimeUnavailable, neural_decode_views

    profile_name = _resolve_neural_profile(quality)
    profile = NEURAL_PROFILES[profile_name]
    if profile.get('sync_enabled', False):
        corrected, geo = _rectify_neural_image(img[:, :, :3] if img.ndim == 3 else img, password)
    else:
        corrected = img[:, :, :3] if img.ndim == 3 else img
        geo = {'angle': 0.0, 'scale': 1.0, 'confidence': 0.0, 'peaks': 0, 'syncEnabled': False}
    views = _build_neural_views(corrected)
    try:
        decoded = neural_decode_views(views, models_dir=models_dir, use_cuda=False, password=password)
    except NeuralRuntimeUnavailable:
        raise

    confidence = float(decoded.get('confidence', decoded.get('bitConfidence', 0.0)))
    return {
        'ok': True,
        'wm': decoded['text'],
        'engine_used': 'neural',
        'fallback_used': False,
        'confidence': confidence,
        'diagnostics': {
            'profile': profile_name,
            'protocol': decoded.get('protocol', 'keyed-v2'),
            'passwordProtected': bool(decoded.get('passwordProtected', True)),
            'visualStrength': profile['residual_strength'],
            'bitConfidence': float(decoded.get('bitConfidence', 0.0)),
            'decodeStrategy': decoded.get('strategy'),
            'geometricCorrection': geo,
            'attemptIndex': decoded.get('attemptIndex'),
            'attempts': decoded.get('attempts'),
            'modelVersion': decoded.get('manifest', {}).get('modelVersion'),
            'modelsDir': models_dir,
        },
    }


def embed_watermark(img, text, password=1, quality='balanced', engine='auto', models_dir=None, self_check=True):
    requested_engine = engine if engine in ('auto', 'legacy', 'neural') else 'auto'
    text_bytes = text.encode('utf-8')
    if requested_engine == 'legacy':
        legacy = embed_watermark_legacy(img, text, password=password, quality=quality, self_check=self_check)
        return _legacy_embed_response(legacy, quality, requested_engine)

    neural_allowed = len(text_bytes) <= NEURAL_MAX_TEXT_BYTES
    large_enough = min(img.shape[:2]) >= 512 if hasattr(img, 'shape') else False

    if requested_engine == 'neural' and not neural_allowed:
        return {
            'ok': False,
            'error': f'Neural watermark supports up to {NEURAL_MAX_TEXT_BYTES} UTF-8 bytes',
            'engine_used': 'neural',
            'fallback_used': False,
        }

    if requested_engine == 'auto' and (not neural_allowed or not large_enough):
        reason = 'payload-too-long' if not neural_allowed else 'image-too-small-for-neural-auto'
        legacy = embed_watermark_legacy(img, text, password=password, quality=quality, self_check=self_check)
        return _legacy_embed_response(legacy, quality, requested_engine, reason)

    try:
        return _neural_embed_impl(
            img,
            text,
            password=password,
            quality=quality,
            models_dir=models_dir,
            self_check=self_check,
        )
    except Exception as exc:
        if requested_engine == 'neural':
            return {
                'ok': False,
                'error': str(exc),
                'engine_used': 'neural',
                'fallback_used': False,
            }
        legacy = embed_watermark_legacy(img, text, password=password, quality=quality, self_check=self_check)
        return _legacy_embed_response(legacy, quality, requested_engine, f'neural-failed:{exc}')


def extract_watermark(img, password=1, quality='balanced', engine='auto', models_dir=None):
    requested_engine = engine if engine in ('auto', 'legacy', 'neural') else 'auto'
    if requested_engine == 'legacy':
        text = extract_watermark_legacy(img, password=password, quality=quality)
        return _legacy_extract_response(text, quality, requested_engine)

    try:
        return _neural_extract_impl(img, password=password, quality=quality, models_dir=models_dir)
    except Exception as exc:
        if requested_engine == 'neural':
            return {
                'ok': False,
                'error': str(exc),
                'engine_used': 'neural',
                'fallback_used': False,
            }
        try:
            text = extract_watermark_legacy(img, password=password, quality=quality)
            return _legacy_extract_response(text, quality, requested_engine, f'neural-failed:{exc}')
        except Exception as legacy_exc:
            return {
                'ok': False,
                'error': str(legacy_exc),
                'engine_used': 'legacy',
                'fallback_used': True,
                'diagnostics': {
                    'fallbackReason': f'neural-failed:{exc}',
                    'legacyError': str(legacy_exc),
                },
            }


def _try_extract_single_with_seed(gray, sd, quality_name, rs_nsym, redundancy,
                                   margin_ratio, num_peaks):
    """Like _try_extract_single but uses sd directly (without +1 offset for DCT seed)."""
    h, w = gray.shape
    cfg = QUALITY[quality_name]
    delta = cfg['delta']

    try:
        hdr_bits = _extract_bits_dct(gray, HEADER_BITS, delta, sd + 1,
                                      redundancy, margin_ratio)
        n_payload = 0
        for i in range(HEADER_BITS):
            n_payload = (n_payload << 1) | int(hdr_bits[i] > 0.5)

        max_blocks = _count_available_blocks(h, w, margin_ratio)
        max_bits = max_blocks // redundancy - HEADER_BITS
        if n_payload <= 0 or n_payload > max_bits:
            return None

        all_bits = _extract_bits_dct(gray, HEADER_BITS + n_payload, delta, sd + 1,
                                      redundancy, margin_ratio)
        return _bits_to_text(all_bits[HEADER_BITS:], rs_nsym)
    except Exception:
        return None


def check_dependencies():
    res = {'ok': True, 'version': RWM_VERSION, 'missing': []}
    for m in ['numpy', 'cv2', 'scipy', 'reedsolo']:
        try:
            __import__(m)
        except ImportError:
            res['ok'] = False
            res['missing'].append(m)
    try:
        try:
            from blind_watermark.mlwm.infer import probe_runtime
        except ImportError:
            from mlwm.infer import probe_runtime
        status = probe_runtime(os.environ.get('LUMINCRYPT_MLWM_MODELS_DIR'))
        res['neuralRuntimeAvailable'] = bool(status.runtime_available)
        res['neuralModelsAvailable'] = bool(status.models_available)
        res['neuralReady'] = bool(status.ready)
        res['neuralModelVersion'] = status.manifest.get('modelVersion')
    except Exception:
        res['neuralRuntimeAvailable'] = False
        res['neuralModelsAvailable'] = False
        res['neuralReady'] = False
        res['neuralModelVersion'] = None
    return res
