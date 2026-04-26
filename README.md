# LuminCrypt

**English | [简体中文](README.zh-CN.md)**

LuminCrypt is a local-first desktop security toolkit for **Unicode steganography detection**, **encrypted invisible text watermarking**, and **robust blind image watermarking**. It helps researchers, creators, publishers, and security teams inspect hidden Unicode characters, embed text fingerprints, and test resilient image watermarks against compression, resizing, cropping, and common distribution damage.

![Electron](https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)

## Why LuminCrypt

Text and images can carry invisible signals: zero-width characters, Unicode Tags, homoglyph substitutions, encrypted text fingerprints, and blind image watermarks. LuminCrypt brings these workflows into one desktop app with reproducible local processing.

Use it to:

- Detect suspicious Unicode characters in pasted text and documents.
- Reveal zero-width characters, BiDi controls, Unicode Tags, variation selectors, homoglyphs, and non-standard spaces.
- Embed and extract encrypted invisible text watermarks.
- Add and recover blind image watermarks through a Python image-processing engine.
- Evaluate an experimental neural robust image watermark pipeline.
- Export detection reports for review, audit, and reproducibility.

## Key Features

- **Unicode hidden character detection**: scans for zero-width characters, BiDi controls, homoglyph attacks, Unicode Tags, variation selectors, special spaces, and AI watermark related Unicode ranges.
- **Encrypted text watermarking**: embeds AES-256-GCM protected payloads into normal text with invisible Unicode carriers and robust shard recovery.
- **Robust image watermarking**: provides a legacy blind watermark engine based on block-DCT, QIM-style embedding, Reed-Solomon recovery, synchronization templates, and multi-scale extraction.
- **Neural watermark research branch**: `codex/mlwm-v1` adds an experimental learning-assisted image watermark engine with PyTorch training, ONNX export, attack simulation, benchmark tooling, and dispatcher fallback.
- **Batch and reporting workflows**: supports batch scanning and JSON, CSV, and PDF report export.
- **Local-first desktop app**: built with Electron, React, TypeScript, and a Python helper for image watermark processing.

## Project Status

| Area | Status |
|---|---|
| Text Unicode detection | Usable |
| Text watermark embed/extract | Usable |
| Legacy image blind watermark | Usable |
| Neural robust image watermark | Experimental, training paused until GPU time is available |
| GitHub branch protection | Enabled on `master` |

The stable branch is `master`. MLWM v1 development lives in `codex/mlwm-v1` and remains a draft integration branch until a trained model is promoted with benchmark results.

## Quick Start

### Requirements

| Tool | Version | Notes |
|---|---:|---|
| Node.js | 18+ | Electron and frontend build |
| npm | 9+ | Package manager |
| Python | 3.10+ runtime, 3.12 recommended for ML | Required for image watermark backend |

### Install

```bash
npm install
pip install -r blind_watermark/requirements.txt
```

For ONNX runtime packaging:

```bash
pip install -r blind_watermark/requirements-onnx.txt
```

For ML training:

```bash
pip install -r blind_watermark/requirements-ml.txt
```

### Development

```bash
npm run dev
```

### Type Check

```bash
npm run typecheck
```

### Python Engine Tests

```bash
python -m unittest discover -s blind_watermark/tests
```

## Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Build the Python image-watermark helper:

```bash
npm run build:python
```

The packaged helper is written to `resources/bin/` and included by `electron-builder`.

## Repository Layout

```text
LuminCrypt/
|-- src/
|   |-- main/             # Electron main process, IPC, helper bridge
|   |-- preload/          # Safe renderer bridge types and APIs
|   `-- renderer/         # React UI and TypeScript watermark logic
|-- blind_watermark/
|   |-- bwm_helper.py     # Python CLI bridge for Electron
|   |-- rwm_engine.py     # Image watermark dispatcher and legacy engine
|   |-- mlwm/             # Neural robust watermark research modules
|   `-- tests/            # Python unit tests
|-- configs/mlwm/         # MLWM training, export, and benchmark configs
|-- docs/                 # Architecture, training, wiki, and traceability docs
|-- resources/            # Packaged binaries and model metadata
`-- .github/workflows/    # CI checks
```

## MLWM v1 Research

The learning-assisted robust image watermark engine is designed for short text or ID payloads and future social-media-style degradation resilience. The current plan combines:

- fixed payload framing with CRC and Reed-Solomon style recovery,
- classical synchronization templates for geometric alignment,
- lightweight PyTorch encoder and decoder networks,
- online attack simulation for JPEG, WEBP, resize, crop, rotation, blur, noise, overlays, and screenshot-like degradation,
- ONNX export for local runtime inference.

See:

- [MLWM Architecture](docs/mlwm/architecture.md)
- [MLWM Training](docs/mlwm/training.md)
- [MLWM Traceability](docs/mlwm/traceability.md)
- [MLWM Wiki Runbook](docs/wiki/MLWM-Training-Runbook.md)

## Search Keywords

Unicode steganography, Unicode watermark, invisible watermark, AI watermark detection, zero-width character detector, homoglyph detection, BiDi control detector, text watermarking, blind image watermark, robust image watermarking, digital watermarking, image forensics, content provenance, Electron security tool.

## License

LuminCrypt is released under the **GPL-3.0** license. See [LICENSE](LICENSE).

The image watermark engine includes deep customization based on the open-source [blind_watermark](https://github.com/guofei9987/blind_watermark) project. See [NOTICE](NOTICE) for attribution.
