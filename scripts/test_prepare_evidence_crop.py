import tempfile
import unittest
from pathlib import Path
from PIL import Image, PngImagePlugin
from prepare_evidence_crop import prepare


class EvidenceCropTest(unittest.TestCase):
    def test_crop_masks_hidden_colours_and_metadata(self):
        with tempfile.TemporaryDirectory() as d:
            src, out = Path(d) / 'source.png', Path(d) / 'crop.png'
            image = Image.new('RGBA', (5, 4), (20, 30, 40, 255))
            image.putpixel((1, 1), (255, 0, 0, 0))
            meta = PngImagePlugin.PngInfo()
            meta.add_text('internal', 'sample hidden identifier')
            image.save(src, pnginfo=meta)
            prepare(src, out, (1, 1, 5, 4), [(2, 2, 4, 4)])
            with Image.open(out) as result:
                self.assertEqual((result.size, result.mode), ((4, 3), 'RGB'))
                self.assertEqual(result.getpixel((0, 0)), (255, 255, 255))
                self.assertEqual(result.getpixel((2, 2)), (36, 34, 56))
                self.assertEqual(result.getpixel((3, 2)), (20, 30, 40))
                self.assertNotIn('internal', result.info)
            with self.assertRaises(ValueError):
                prepare(src, out, (-1, 1, 5, 4), [])


if __name__ == '__main__':
    unittest.main()
