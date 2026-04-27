import json
import unittest
from pathlib import Path

from blind_watermark.mlwm.traceability import config_hash, write_json


class TraceabilityTests(unittest.TestCase):
  def test_config_hash_is_stable(self):
    cfg = {'b': 2, 'a': 1}
    self.assertEqual(config_hash(cfg), config_hash({'a': 1, 'b': 2}))

  def test_write_json_creates_parent(self):
    base = Path('tmp/mlwm-tests').resolve()
    target = base / 'nested' / 'payload.json'
    if target.exists():
      target.unlink()
    write_json(target, {'ok': True})
    self.assertTrue(target.exists())
    self.assertEqual(json.loads(target.read_text(encoding='utf-8'))['ok'], True)


if __name__ == '__main__':
  unittest.main()
