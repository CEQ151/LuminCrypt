import unittest

from blind_watermark import rwm_engine


class MlwmRuntimeTests(unittest.TestCase):
  def test_alpha1_neural_profiles_do_not_inject_untrained_sync_template(self):
    for profile in rwm_engine.NEURAL_PROFILES.values():
      self.assertFalse(profile.get('sync_enabled', False))
      self.assertEqual(profile.get('template_strength'), 0.0)

  def test_neural_profiles_expose_visual_strength_ladder(self):
    self.assertEqual(set(rwm_engine.NEURAL_PROFILES.keys()), {'trace', 'faint', 'light', 'balanced', 'strong', 'robust'})
    self.assertEqual(rwm_engine._resolve_neural_profile('invisible'), 'light')
    self.assertLess(rwm_engine.NEURAL_PROFILES['trace']['residual_strength'], rwm_engine.NEURAL_PROFILES['faint']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['faint']['residual_strength'], rwm_engine.NEURAL_PROFILES['light']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['light']['residual_strength'], rwm_engine.NEURAL_PROFILES['balanced']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['balanced']['residual_strength'], rwm_engine.NEURAL_PROFILES['strong']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['strong']['residual_strength'], rwm_engine.NEURAL_PROFILES['robust']['residual_strength'])
    self.assertLess(rwm_engine.NEURAL_PROFILES['balanced']['residual_strength'], rwm_engine.NEURAL_PROFILES['robust']['residual_strength'])

  def test_only_risk_profiles_allow_self_check_failure(self):
    for name in ['trace', 'faint', 'light', 'balanced', 'strong', 'robust']:
      self.assertFalse(rwm_engine.NEURAL_PROFILES[name]['allow_self_check_failure'])

  def test_low_visibility_profiles_use_frequency_spread_codec(self):
    for name in ['trace', 'faint', 'light', 'balanced']:
      self.assertEqual(rwm_engine.NEURAL_PROFILES[name].get('codec'), 'frequency_spread_v2')
    for name in ['strong', 'robust']:
      self.assertNotEqual(rwm_engine.NEURAL_PROFILES[name].get('codec'), 'frequency_spread_v2')


if __name__ == '__main__':
  unittest.main()
