"""Inline the photos and depth maps from assets/ into template.html -> index.html.

Run from this folder: python3 build.py
Add a photo with: python3 depth.py path/to/photo.jpg name   (e.g. name = esterno)
"""
import base64
import pathlib

here = pathlib.Path(__file__).parent
assets = here / 'assets'
lines = []
for jpg in sorted(assets.glob('*.jpg')):
    depth = assets / (jpg.stem + '-depth.png')
    if not depth.exists():
        continue
    for key, path, mime in ((jpg.stem, jpg, 'image/jpeg'), (jpg.stem + '-depth', depth, 'image/png')):
        lines.append(f"  '{key}': 'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}',")
block = ('<!-- Photos and their depth maps, inlined so WebGL can read them from any origin (also file://) -->\n'
         '<script>\nwindow.PHOTO_ASSETS = {\n' + '\n'.join(lines) + '\n};\n</script>')
html = (here / 'template.html').read_text().replace('<!--PHOTO_ASSETS-->', block)
(here / 'index.html').write_text(html)
print('index.html', len(html) // 1024, 'KB,', len(lines) // 2, 'photos')
