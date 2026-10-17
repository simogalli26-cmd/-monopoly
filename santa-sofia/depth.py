"""Make a depth map for a photo with MiDaS small (ONNX) and store both in assets/.

Usage: python3 depth.py photo.jpg name
Needs: pip install onnxruntime pillow numpy; the model is downloaded once from the MiDaS releases.
"""
import pathlib
import sys
import urllib.request

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

here = pathlib.Path(__file__).parent
model = here / '.midas_small.onnx'
if not model.exists():
    urllib.request.urlretrieve('https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx', model)

src, name = sys.argv[1], sys.argv[2]
sess = ort.InferenceSession(str(model))
im = Image.open(src).convert('RGB')
x = np.asarray(im.resize((256, 256), Image.BICUBIC), dtype=np.float32) / 255.0
x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
d = sess.run(None, {sess.get_inputs()[0].name: x})[0].squeeze()
d = (d - d.min()) / (d.max() - d.min() + 1e-6)
w = min(1600, im.width)
h = round(im.height * w / im.width)
im.resize((w, h), Image.LANCZOS).save(here / 'assets' / f'{name}.jpg', quality=84, optimize=True, progressive=True)
Image.fromarray((d * 255).astype(np.uint8)).resize((512, round(512 * h / w)), Image.BICUBIC) \
    .filter(ImageFilter.GaussianBlur(2)).save(here / 'assets' / f'{name}-depth.png', optimize=True)
print(name, w, h)
