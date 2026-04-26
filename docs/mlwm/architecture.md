# MLWM v1 Architecture

MLWM v1 adds a neural short-payload image watermark engine next to the legacy DCT engine.

## Core design

- Payload is fixed to 256 bits after framing and RS encoding.
- Text payload is limited to 16 UTF-8 bytes.
- Legacy frequency-domain synchronization remains the geometric anchor.
- Neural embed/extract only handles payload recovery.
- Runtime uses ONNX for desktop inference and PyTorch for training/export.

## Runtime flow

1. Encode short text into a fixed frame with CRC32 and RS parity.
2. Run the encoder network to predict a residual map.
3. Apply the residual to the image and inject the classical sync template.
4. At extraction time, detect the sync template, rectify the image, and score several candidate views.
5. Aggregate decoder logits, RS-decode, and CRC-check the payload.
6. If neural decode fails in `auto`, fall back to the legacy engine.

## Training flow

- Stage A: decoder warmup with deterministic fixed residuals.
- Stage B: joint encoder/decoder training with medium attacks.
- Stage C: hard-negative fine-tune on the strongest attack chains.
- Stage D: confidence calibration and export freeze.
