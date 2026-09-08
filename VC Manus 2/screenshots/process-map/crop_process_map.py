from PIL import Image, ImageEnhance, ImageFilter
from pathlib import Path
src = Image.open('/home/ubuntu/upload/Screenshot2026-09-06at3.44.08PM.webp').convert('RGB')
out = Path('/home/ubuntu/tmp/process-map-crops')
out.mkdir(parents=True, exist_ok=True)
# Preserve full width but split into four overlapping horizontal bands for legibility.
bands = [(0, 0, 2048, 240), (0, 180, 2048, 470), (0, 410, 2048, 700), (0, 640, 2048, 953)]
for i, box in enumerate(bands, 1):
    crop = src.crop(box).resize(((box[2]-box[0])*2, (box[3]-box[1])*2))
    crop = ImageEnhance.Contrast(crop).enhance(1.35)
    crop = ImageEnhance.Sharpness(crop).enhance(1.8)
    crop.save(out / f'band_{i:02d}.png')
print(out)
