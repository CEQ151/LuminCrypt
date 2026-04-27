import unittest

from blind_watermark import rwm_engine


class MlwmRuntimeTests(unittest.TestCase):
  def test_alpha1_neural_profiles_do_not_inject_untrained_sync_template(self):
    for profile in rwm_engine.NEURAL_PROFILES.values():
      self.assertFalse(profile.get('sync_enabled', False))
      self.assertEqual(profile.get('template_strength'), 0.0)

  def test_neural_profiles_expose_three_visual_strengths(self):
    self.assertEqual(set(rwm_engine.NEURAL_PROFILES.keys()), {'invisible', 'balanced', 'robust'})
    self.assertLess(rwm_engine.NEURAL_PROFILES['invisible']['residual_strength'], rwm_engine.NEURAL_PROFILES['balanced']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['balanced']['residual_strength'], rwm_engine.NEURAL_PROFILES['robust']['residual_strength'])


if __name__ == '__main__':
  unittest.main()
