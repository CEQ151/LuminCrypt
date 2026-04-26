import unittest

from blind_watermark.mlwm.download_unsplash_lite import image_url


class DownloadUnsplashLiteTests(unittest.TestCase):
  def test_image_url_adds_resize_parameters(self):
    url = image_url('https://images.unsplash.com/photo.jpg?ixid=abc', width=1024, quality=85)
    self.assertIn('ixid=abc', url)
    self.assertIn('w=1024', url)
    self.assertIn('q=85', url)
    self.assertIn('fit=max', url)


if __name__ == '__main__':
  unittest.main()
