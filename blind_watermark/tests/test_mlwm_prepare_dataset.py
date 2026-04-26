import json
import shutil
import unittest
from pathlib import Path

import cv2
import numpy as np

from blind_watermark.mlwm.prepare_dataset import prepare_dataset


class PrepareDatasetTests(unittest.TestCase):
  def test_prepare_dataset_filters_dedupes_and_writes_manifest(self):
    base = Path('tmp/mlwm-prepare-tests').resolve()
    if base.exists():
      shutil.rmtree(base)
    source = base / 'source'
    out = base / 'data'
    source.mkdir(parents=True)

    large = np.full((640, 640, 3), 127, dtype=np.uint8)
    small = np.full((128, 128, 3), 64, dtype=np.uint8)
    cv2.imwrite(str(source / 'large_a.png'), large)
    cv2.imwrite(str(source / 'large_duplicate.png'), large)
    cv2.imwrite(str(source / 'small.png'), small)

    manifest = prepare_dataset(
      [str(source)],
      str(out),
      val_ratio=0.25,
      min_size=512,
      seed=1,
      copy_mode='copy',
    )

    self.assertEqual(manifest['counts']['total'], 1)
    self.assertEqual(manifest['counts']['train'], 1)
    self.assertEqual(manifest['counts']['val'], 0)
    self.assertEqual(manifest['rejected'], 1)
    self.assertTrue((out / 'dataset_manifest.json').exists())

    loaded = json.loads((out / 'dataset_manifest.json').read_text(encoding='utf-8'))
    self.assertEqual(loaded['counts']['total'], 1)


if __name__ == '__main__':
  unittest.main()
