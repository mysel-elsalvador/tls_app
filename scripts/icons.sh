#!/usr/bin/env bash
# Regenerates the PNG app icons in public/ from scripts/icon.svg.
# Needs ImageMagick (`convert`). The PNGs are committed; run only when the
# icon changes.
set -euo pipefail
cd "$(dirname "$0")/.."
for size in 192 512; do
  convert -background none -density 300 scripts/icon.svg -resize ${size}x${size} "public/icon-$size.png"
done
convert -background none -density 300 scripts/icon.svg -resize 180x180 public/apple-touch-icon.png
