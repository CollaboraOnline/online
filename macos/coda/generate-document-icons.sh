#!/bin/sh
# Generate document type icons from SVGs
set -e

ASSETS="$SRCROOT/coda/Assets.xcassets"
SVGS="$SRCROOT/../../browser/dist/images"

# Create image sets if they don't exist
for iconset in DocumentIcon SpreadsheetIcon PresentationIcon DrawingIcon; do
  mkdir -p "$ASSETS/${iconset}.imageset"

  # Create Contents.json if it doesn't exist
  if [ ! -f "$ASSETS/${iconset}.imageset/Contents.json" ]; then
    cat > "$ASSETS/${iconset}.imageset/Contents.json" <<EOF
{
  "images" : [
    {
      "filename" : "${iconset}.png",
      "idiom" : "universal",
      "scale" : "1x"
    },
    {
      "idiom" : "universal",
      "scale" : "2x"
    },
    {
      "idiom" : "universal",
      "scale" : "3x"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
EOF
  fi
done

# Convert SVGs to PNGs using sips (no external dependencies needed)
# sips can read SVG and convert to PNG
sips -s format png -z 512 512 "$SVGS/x-office-document.svg" --out "$ASSETS/DocumentIcon.imageset/DocumentIcon.png" >/dev/null 2>&1
sips -s format png -z 512 512 "$SVGS/x-office-spreadsheet.svg" --out "$ASSETS/SpreadsheetIcon.imageset/SpreadsheetIcon.png" >/dev/null 2>&1
sips -s format png -z 512 512 "$SVGS/x-office-presentation.svg" --out "$ASSETS/PresentationIcon.imageset/PresentationIcon.png" >/dev/null 2>&1
sips -s format png -z 512 512 "$SVGS/x-office-drawing.svg" --out "$ASSETS/DrawingIcon.imageset/DrawingIcon.png" >/dev/null 2>&1

echo "Document type icons generated successfully"
