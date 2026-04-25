# blind_watermark (Modified)

This directory contains the Python image blind watermark engine used by LuminCrypt.
It is a heavily modified version of the original [blind_watermark](https://github.com/guofei9987/blind_watermark) project by guofei9987.

## Modifications in LuminCrypt

- **Adaptive Quality Profiles**: Dynamically adjusts Reed-Solomon error correction (`rs_nsym`) and block redundancy based on selected quality (invisible, balanced, robust).
- **Multi-scale Embedding & Extraction**: Embeds the watermark at multiple resolutions (e.g., 1.0x, 0.75x, 0.5x) to resist severe downscaling and platform compression.
- **Enhanced Synchronization**: Uses a dual-ring, multi-peak template for better resistance against rotation, cropping, and aspect ratio changes.
- **Edge Exclusion**: Avoids embedding watermarks in the outermost edges of the image where cropping is most likely to occur.
- **Self-Check**: Automatically verifies the embedded watermark and falls back to a more robust quality setting if extraction fails.
- **CLI Bridge**: Uses `bwm_helper.py` to communicate with the Electron main process via standard input/output.

## License

The original code is licensed under the MIT License. See the `NOTICE` file in the root directory for full copyright and license details.