#!/bin/bash
# SEPonDashi Uninstaller for macOS

DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/SEPonDashi"
BACKUP="$HOME/Desktop/SEPonDashi_backup"
NEW_CONFIG="$HOME/Library/Application Support/SEPonDashi/config.json"

echo ""
echo " ================================================================"
echo "   SEPonDashi  |  Uninstaller (macOS)"
echo " ================================================================"
echo ""

if [ ! -d "$DEST" ]; then
    echo " SEPonDashi is not installed."
    echo " Folder not found: $DEST"
    echo ""
    exit 0
fi

echo " Installed at: $DEST"
echo ""
echo " ----------------------------------------------------------------"
echo "  What would you like to do with your SE data?"
echo " ----------------------------------------------------------------"
echo ""
echo "   1  Keep data  ( backup to Desktop )  Recommended"
echo "   2  Full delete  ( cannot be undone )"
echo "   3  Cancel"
echo ""
read -rp "Enter number (1 / 2 / 3): " CHOICE
echo ""

case "$CHOICE" in
    1)
        echo " Backing up SE data to Desktop before uninstall..."
        echo ""

        rm -rf "$BACKUP"
        mkdir -p "$BACKUP"

        # New config location takes priority (main.js v5+)
        if [ -f "$NEW_CONFIG" ]; then
            cp "$NEW_CONFIG" "$BACKUP/config.json"
            echo " [1/3] config.json backed up (from user data)"
        elif [ -f "$DEST/config/config.json" ]; then
            cp "$DEST/config/config.json" "$BACKUP/config.json"
            echo " [1/3] config.json backed up (from extension folder)"
        else
            echo " [1/3] config.json not found, skipped"
        fi

        if [ -d "$DEST/assets/audio" ]; then
            cp -R "$DEST/assets/audio" "$BACKUP/audio"
            echo " [2/3] Audio files backed up"
        else
            echo " [2/3] No audio files found, skipped"
        fi

        rm -rf "$DEST"
        if [ -d "$DEST" ]; then
            echo ""
            echo " [ERROR] Delete failed."
            echo " Please close Premiere Pro and try again."
            echo ""
            exit 1
        fi

        echo " [3/3] SEPonDashi removed."
        echo ""
        echo " ================================================================"
        echo "   Uninstall complete."
        echo ""
        echo "   Backup saved to: $BACKUP"
        echo ""
        echo "   To restore after reinstall:"
        echo "     Run install.sh, then copy"
        echo "     $BACKUP/config.json"
        echo "     to $NEW_CONFIG"
        echo ""
        echo "   Restart Premiere Pro."
        echo " ================================================================"
        ;;
    2)
        echo " WARNING: All SE data will be permanently deleted."
        echo ""
        read -rp "Type  yes  to confirm: " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo " Cancelled. Nothing was changed."
            exit 0
        fi
        echo ""
        rm -rf "$DEST"
        if [ -d "$DEST" ]; then
            echo " [ERROR] Delete failed."
            echo " Please close Premiere Pro and try again."
            exit 1
        fi
        echo " SEPonDashi fully removed."
        echo ""
        echo " ================================================================"
        echo "   Uninstall complete.  Restart Premiere Pro."
        echo " ================================================================"
        ;;
    *)
        echo " Cancelled. Nothing was changed."
        ;;
esac
echo ""
