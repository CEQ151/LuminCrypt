import unittest

from blind_watermark import rwm_engine


class MlwmRuntimeTests(unittest.TestCase):
  def test_alpha1_neural_profiles_do_not_inject_untrained_sync_template(self):
    for profile in rwm_engine.NEURAL_PROFILES.values():
      self.assertFalse(profile.get('sync_enabled', False))
      self.assertEqual(profile.get('template_strength'), 0.0)


if __name__ == '__main__':
  unittest.main()
