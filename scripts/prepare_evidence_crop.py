"""Produce an opaque evidence PNG from an approved slide rendering."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw


def prepare(source, target, crop, masks):
    if source.resolve() == target.resolve():
        raise ValueError("Use a separate output PNG.")
    with Image.open(source) as src:
        if src.format != "PNG":
            raise ValueError("Export a PNG of the visible slide first.")
        bounds = src.size
        for left, top, right, bottom in [crop, *masks]:
            if not (0 <= left < right <= bounds[0] and 0 <= top < bottom <= bounds[1]):
                raise ValueError("Rectangle lies outside the source image or is empty.")
        # A fresh RGB surface drops metadata and hidden colour under transparency.
        image = Image.new("RGB", bounds, "white")
        rgba = src.convert("RGBA")
        image.paste(rgba, mask=rgba.getchannel("A"))
    draw = ImageDraw.Draw(image)
    for left, top, right, bottom in masks:
        draw.rectangle((left, top, right - 1, bottom - 1), fill="#242238")
    image.crop(crop).save(target, format="PNG")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--crop", required=True, type=int, nargs=4, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    p.add_argument("--mask", action="append", default=[], type=int, nargs=4,
                   help="Opaque rectangle in full source-image pixels. Repeat for additional identifiers.")
    args = p.parse_args()
    prepare(args.source, args.output, args.crop, args.mask)
