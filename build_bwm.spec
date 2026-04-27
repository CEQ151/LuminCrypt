# -*- mode: python ; coding: utf-8 -*-
# ─────────────────────────────────────────────────────────────────────────────
# PyInstaller spec for bwm_helper (rwm_engine backend) — single-file standalone executable
#
# Usage (run once from the project root, developer machine only):
#   pip install numpy opencv-python scipy reedsolo pyinstaller
#   pyinstaller --distpath resources/bin --workpath build/pyinstaller build_bwm.spec
#
# Output:
#   resources/bin/bwm_helper.exe   (Windows)
#   resources/bin/bwm_helper       (macOS / Linux)
#
# The generated binary is bundled into the Electron app via electron-builder
# so end-users never need to install Python or any pip package.
# ─────────────────────────────────────────────────────────────────────────────

from PyInstaller.utils.hooks import collect_all

# rwm_engine is in pathex, no extra package to collect
bwm_datas, bwm_binaries, bwm_hidden = [], [], []
try:
    ort_datas, ort_binaries, ort_hidden = collect_all('onnxruntime')
except Exception:
    ort_datas, ort_binaries, ort_hidden = [], [], []

a = Analysis(
    ['blind_watermark/bwm_helper.py'],
    # Add the directory so rwm_engine is found at import time
    pathex=['blind_watermark'],
    binaries=bwm_binaries + ort_binaries,
    datas=bwm_datas + ort_datas,
    hiddenimports=bwm_hidden + [
        'mlwm',
        'mlwm.codec',
        'mlwm.infer',
        # OpenCV
        'cv2',
        # NumPy / SciPy internals often missed by static analysis
        'numpy',
        'numpy.core._multiarray_umath',
        'scipy',
        'scipy.fft',
        'scipy.fftpack',
        'scipy.ndimage',
        # Reed-Solomon error correction
        'reedsolo',
    ] + ort_hidden,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Strip heavy unused packages to keep exe smaller
        'matplotlib',
        'IPython',
        'notebook',
        'pytest',
        'tkinter',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='bwm_helper',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # UPX compresses the exe (~30% smaller). Set upx=False if UPX is not installed.
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    # Keep console=True so the Electron main process can capture stdout JSON
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
