# MLWM v1 Benchmark Protocol

Benchmark each engine on the same image corpus with the same payload family.

## Attack suite

- Clean
- JPEG q75
- JPEG q50
- WEBP q50
- Resize to 50 percent then scale back
- 10 percent edge crop then scale back
- Rotation +/- 3 degrees + JPEG q75
- Blur / noise medium
- Corner overlay <= 15 percent area
- Screenshot simulation

## Success criteria

- Clean exact-match >= 99.5%
- JPEG q75 >= 98%
- JPEG q50 >= 95%
- WEBP q50 >= 93%
- Resize 50 percent >= 92%
- Crop 10 percent >= 88%
- Rotation + JPEG >= 90%
- Blur / noise >= 90%
- Overlay <= 15 percent >= 80%

Benchmarks should record engine used, fallback behavior, and confidence output where available.
