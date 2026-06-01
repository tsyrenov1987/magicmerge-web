#!/usr/bin/env bash
# Magic Merge — import iOS Assets.xcassets PNGs into web /public/assets/ as
# WebP, downscaled to a target max dimension. Categorizes outputs by prefix
# so we can lazy-load by section.
#
# Usage:
#   ./scripts/import-assets.sh
#
# Defaults are tuned for "all HD" — every imageset is imported. Adjust
# WEBP_QUALITY and MAX_DIM at the top to trade off file size vs detail.

set -euo pipefail

SRC="/Users/nikolaitsyrenov/Desktop/Magic Merge/Magic Merge/Assets.xcassets"
DST="$(cd "$(dirname "$0")/.." && pwd)/public/assets"

# Smaller items can stay smaller; backgrounds + buildings hold up at higher dim
WEBP_QUALITY_ITEM=82
WEBP_QUALITY_BUILDING=80
WEBP_QUALITY_BG=72
WEBP_QUALITY_CHAR=84

MAX_DIM_ITEM=256          # item sprites — board cells are <128px on phones
MAX_DIM_GENERATOR=256
MAX_DIM_BUILDING=384      # garden cells are larger, want crisp at 192px @2x
MAX_DIM_GARDEN_DECO=256
MAX_DIM_CHARACTER=384     # Lily, Saffi, Root — character cards
MAX_DIM_SPIN=256
MAX_DIM_BG=1024           # backgrounds — they're huge in source
MAX_DIM_MISC=512

# Tools
if ! command -v cwebp >/dev/null; then
  echo "[error] cwebp missing — brew install webp"
  exit 1
fi
if ! command -v sips >/dev/null; then
  echo "[error] sips missing (macOS only)"
  exit 1
fi

if [[ ! -d "$SRC" ]]; then
  echo "[error] iOS Assets.xcassets not found at: $SRC"
  exit 1
fi

mkdir -p "$DST"/{items,buildings,garden,characters,generators,spin,misc}

# Categorize a filename stem and emit "<category> <max-dim> <quality>"
categorize() {
  local stem="$1"
  case "$stem" in
    artifact_l*|crystal_l*|fae_l*|fleet_l*|forge_l*|ocean_l*|rose_l*|stellar_l*|symphony_l*)
      echo "items $MAX_DIM_ITEM $WEBP_QUALITY_ITEM" ;;
    generator_t*)
      echo "generators $MAX_DIM_GENERATOR $WEBP_QUALITY_ITEM" ;;
    garden_rose_bed|garden_fountain|garden_greenhouse|garden_fairy_house|garden_moon_obelisk|garden_fire_tower|garden_crystal_cave|garden_tree_of_life|garden_rainbow_bridge)
      echo "buildings $MAX_DIM_BUILDING $WEBP_QUALITY_BUILDING" ;;
    garden_*)
      echo "garden $MAX_DIM_GARDEN_DECO $WEBP_QUALITY_ITEM" ;;
    lily_fairy|safi_owl|root_gardener)
      echo "characters $MAX_DIM_CHARACTER $WEBP_QUALITY_CHAR" ;;
    spin_*)
      echo "spin $MAX_DIM_SPIN $WEBP_QUALITY_ITEM" ;;
    lucky_chest)
      echo "items $MAX_DIM_ITEM $WEBP_QUALITY_ITEM" ;;
    game_bg_*|loading_screen)
      echo "misc $MAX_DIM_BG $WEBP_QUALITY_BG" ;;
    studio_logo|rose)
      echo "misc $MAX_DIM_MISC $WEBP_QUALITY_CHAR" ;;
    *)
      echo "misc $MAX_DIM_MISC $WEBP_QUALITY_ITEM" ;;
  esac
}

total_imagesets=0
processed=0
skipped=0
totalBytesIn=0
totalBytesOut=0

while IFS= read -r dir; do
  total_imagesets=$((total_imagesets + 1))
  stem=$(basename "$dir" .imageset)
  src_png=""
  # Prefer @3x then @2x then @1x then plain
  for cand in "$dir/${stem}@3x.png" "$dir/${stem}@2x.png" "$dir/${stem}.png"; do
    if [[ -f "$cand" ]]; then
      src_png="$cand"
      break
    fi
  done
  if [[ -z "$src_png" ]]; then
    echo "[skip] $stem (no PNG inside imageset)"
    skipped=$((skipped + 1))
    continue
  fi

  read -r category max_dim quality < <(categorize "$stem")
  out_dir="$DST/$category"
  out_webp="$out_dir/${stem}.webp"

  # Get source dimensions
  pw=$(sips -g pixelWidth "$src_png" 2>/dev/null | tail -1 | awk '{print $2}')
  ph=$(sips -g pixelHeight "$src_png" 2>/dev/null | tail -1 | awk '{print $2}')

  if [[ -z "$pw" || -z "$ph" ]]; then
    echo "[skip] $stem (sips couldn't read dimensions)"
    skipped=$((skipped + 1))
    continue
  fi

  # Decide target dim — never upscale
  target=$max_dim
  if (( pw < target && ph < target )); then
    target=$(( pw > ph ? pw : ph ))
  fi

  # Make a temp downscaled PNG via sips, then encode WebP
  tmp_png=$(mktemp -t mm-resize.XXXXXX).png
  sips -Z "$target" "$src_png" --out "$tmp_png" >/dev/null 2>&1

  # Encode WebP with alpha
  cwebp -quiet -q "$quality" -metadata none -alpha_q 90 "$tmp_png" -o "$out_webp" 2>/dev/null

  rm -f "$tmp_png"

  if [[ ! -f "$out_webp" ]]; then
    echo "[fail] $stem"
    skipped=$((skipped + 1))
    continue
  fi

  size_in=$(stat -f%z "$src_png")
  size_out=$(stat -f%z "$out_webp")
  totalBytesIn=$(( totalBytesIn + size_in ))
  totalBytesOut=$(( totalBytesOut + size_out ))
  processed=$((processed + 1))

  printf "[ok] %-36s %4dx%-4d  %6d KB → %5d KB  (%s/%d, q%d)\n" \
    "$stem" "$pw" "$ph" $(( size_in / 1024 )) $(( size_out / 1024 )) \
    "$category" "$target" "$quality"
done < <(find "$SRC" -name "*.imageset" -type d | sort)

echo ""
echo "=== Summary ==="
echo "Imagesets seen:    $total_imagesets"
echo "Converted:         $processed"
echo "Skipped:           $skipped"
printf "Source PNG total:  %.1f MB\n" "$(echo "$totalBytesIn / 1048576" | bc -l)"
printf "WebP output total: %.1f MB\n" "$(echo "$totalBytesOut / 1048576" | bc -l)"
if (( totalBytesIn > 0 )); then
  printf "Compression ratio: %.1f%%\n" "$(echo "$totalBytesOut * 100 / $totalBytesIn" | bc -l)"
fi

# Per-category totals
echo ""
echo "=== Per-category output ==="
for sub in items buildings garden characters generators spin misc; do
  c=$(find "$DST/$sub" -maxdepth 1 -name '*.webp' 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$c" -gt 0 ]]; then
    b=$(du -sk "$DST/$sub" | awk '{print $1}')
    printf "  %-13s %4d files  %6d KB\n" "$sub" "$c" "$b"
  fi
done

echo ""
echo "Output: $DST"
