#!/bin/bash
# SEPonDashi Installer for macOS
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/SEPonDashi"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/SEPonDashi"
IS_UPDATE=0

echo ""
echo " ================================================================"
echo "   SEPonDashi  |  Installer (macOS)"
echo " ================================================================"
echo ""

# --- Check source folder ---
if [ ! -d "$SRC" ]; then
    echo " [ERROR] SEPonDashi folder not found."
    echo " Make sure the SEPonDashi folder is next to this file."
    echo " Expected: $SRC"
    exit 1
fi

# --- Check existing install ---
if [ -d "$DEST" ]; then
    IS_UPDATE=1
    echo " Existing install found. Running update..."
    echo " Your registered SE data will be preserved."
else
    echo " Starting fresh installation..."
fi
echo ""

# ================================================================
#  STEP 1 : PlayerDebugMode
# ================================================================
echo " [1/3] Enabling Premiere Pro extension mode..."

defaults write com.adobe.CSXS.12 PlayerDebugMode 1 2>/dev/null || true
defaults write com.adobe.CSXS.11 PlayerDebugMode 1 2>/dev/null || true

echo "        OK  ( CEP 11 + CEP 12 )"
echo ""

# ================================================================
#  STEP 2 : Copy files
# ================================================================
echo " [2/3] Copying files..."

mkdir -p "$DEST"

# Remove old code folders before copying to ensure clean update
rm -rf "$DEST/CSXS" "$DEST/js" "$DEST/jsx" "$DEST/css" "$DEST/lib"

# Copy code folders fresh
cp -R "$SRC/CSXS" "$DEST/"
cp -R "$SRC/js"   "$DEST/"
cp -R "$SRC/jsx"  "$DEST/"
cp -R "$SRC/css"  "$DEST/"
cp -R "$SRC/lib"  "$DEST/"
cp -f "$SRC/index.html" "$DEST/index.html"

# config.json : copy only on fresh install (preserve user data on update)
mkdir -p "$DEST/config"
if [ ! -f "$DEST/config/config.json" ]; then
    cp "$SRC/config/config.json" "$DEST/config/config.json"
fi

# assets/audio : create folder only, never overwrite audio files
mkdir -p "$DEST/assets/audio"

# Verify
if [ ! -f "$DEST/index.html" ]; then
    echo " [ERROR] Installation verification failed."
    echo " index.html not found at: $DEST"
    exit 1
fi

echo "        OK"
echo ""

# ================================================================
#  STEP 3 : Complete
# ================================================================
echo " [3/3] Done!"
echo ""
echo " ================================================================"
if [ "$IS_UPDATE" -eq 1 ]; then
    echo "   UPDATED  -  SE data has been preserved."
else
    echo "   INSTALLED"
fi
echo ""
echo "   Location : $DEST"
echo ""
echo "   Next steps:"
echo "     1. Restart Premiere Pro"
echo "     2. Window - Extensions - SE Pon-dashi"
echo " ================================================================"
echo ""
