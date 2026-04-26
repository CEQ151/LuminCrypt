<div align="center">
  <h1>LuminCrypt</h1>
  <p><strong>Local-first Unicode steganography detection and robust watermark toolkit for text and images.</strong></p>

  <p>
    <a href="README.zh-CN.md">简体中文</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-39-47848F?logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/License-GPL--3.0-blue.svg" alt="License" />
  </p>

  <img src="https://github.com/user-attachments/assets/ae9e81a0-a1d4-4271-a0a0-ab17c291bba9" width="220" alt="LuminCrypt logo" />
</div>

---

LuminCrypt is a desktop security toolkit for **Unicode hidden-character detection**, **encrypted invisible text watermarking**, and **robust blind image watermarking**. It helps researchers, creators, publishers, and security teams inspect suspicious Unicode content, embed recoverable text fingerprints, and test image watermarks against compression, resizing, cropping, and platform re-encoding.

## Key Features

- **Unicode hidden character detection**: finds zero-width characters, BiDi controls, homoglyphs, Unicode Tags, variation selectors, and non-standard spaces.
- **Encrypted text watermarking**: embeds AES-256-GCM protected payloads into normal text with invisible Unicode carriers and robust redundancy.
- **Blind image watermarking**: uses a Python image watermark engine based on block-DCT, QIM-style embedding, Reed-Solomon recovery, and multi-scale extraction.
- **Batch processing and reports**: scans files in batches and exports detection results as JSON, CSV, or PDF.
- **Local desktop workflow**: built with Electron, React, TypeScript, and a Python helper for image watermark processing.

## Screenshots

<table>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/f12aaab2-747b-4cd8-b796-4b774d5ce56a" width="100%" alt="LuminCrypt screenshot 1" /></td>
    <td><img src="https://github.com/user-attachments/assets/93dcb2ac-b11e-4c65-b47f-70a842f79372" width="100%" alt="LuminCrypt screenshot 2" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/770361e8-34f7-4f58-ba98-1d113b9c2a60" width="100%" alt="LuminCrypt screenshot 3" /></td>
    <td><img src="https://github.com/user-attachments/assets/b677c03c-fa24-4d0e-97e6-1e174adc5010" width="100%" alt="LuminCrypt screenshot 4" /></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/8dce171c-c251-49b9-8799-69c80cbb756f" width="100%" alt="LuminCrypt screenshot 5" /></td>
    <td><img src="https://github.com/user-attachments/assets/d9107174-6f9a-417b-a584-bbf89c7cc11f" width="100%" alt="LuminCrypt screenshot 6" /></td>
  </tr>
</table>

## Requirements

| Tool | Version | Notes |
|---|---:|---|
| Node.js | 18+ | Electron and frontend build |
| npm | 9+ | Package manager |
| Python | 3.10+ recommended | Required for the image watermark backend |

## Quick Start

Install Node dependencies:

```bash
npm install
```

Install Python image-watermark dependencies:

```bash
pip install -r blind_watermark/requirements.txt
```

Start the development app:

```bash
npm run dev
```

Run TypeScript checks:

```bash
npm run typecheck
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

The packaged helper is written to `resources/bin/bwm_helper.exe` and included by `electron-builder`.

## Windows Helper Scripts

- `start.bat`: interactive launcher for development and preview workflows.
- `pack.bat`: one-click Windows packaging script that checks the environment, installs dependencies, builds the Python helper, and runs `electron-builder`.
- `build.bat`: compatibility wrapper that delegates to `pack.bat` when available.

## Repository Layout

```text
LuminCrypt/
|-- src/
|   |-- main/           # Electron main process, security policy, IPC
|   |-- preload/        # Context-isolated preload bridge
|   `-- renderer/       # React UI and TypeScript logic
|       |-- core/       # Text watermarking and Unicode detection
|       `-- components/ # React components
|-- blind_watermark/
|   |-- rwm_engine.py   # Image blind watermark engine
|   `-- bwm_helper.py   # CLI bridge used by Electron
`-- resources/          # Static assets and packaged binaries
```

## Search Keywords

Unicode steganography, Unicode watermark, invisible watermark, AI watermark detection, zero-width character detector, homoglyph detection, BiDi control detector, text watermarking, blind image watermark, robust image watermarking, digital watermarking, image forensics, content provenance, Electron security tool.

## License

LuminCrypt is released under the **GPL-3.0** license. See [LICENSE](LICENSE).

The image watermark engine includes customization based on the open-source [blind_watermark](https://github.com/guofei9987/blind_watermark) project. See [NOTICE](NOTICE) for attribution.
