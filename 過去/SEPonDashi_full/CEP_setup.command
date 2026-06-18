#!/bin/bash
# SEポン出しパネル - セットアップスクリプト（Mac）
# CEP デバッグモード有効化

echo "============================================"
echo " SEポン出しパネル - セットアップ"
echo " CEP デバッグモード有効化"
echo "============================================"
echo ""

# --- デバッグモード有効化 ---
echo "[1/3] デバッグモードを有効化しています..."

# CSXS.11（CEP 11 / Premiere 2024以前 向け）
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
echo "    CSXS.11 - 完了"

# CSXS.12（CEP 12 / Premiere 2025 v25.x 向け）← 今回の修正ポイント
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
echo "    CSXS.12 - 完了"

# CSXS.10（念のため旧バージョンも）
defaults write com.adobe.CSXS.10 PlayerDebugMode 1

echo ""
echo "[2/3] extensions フォルダを確認・作成しています..."

EXT_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"

if [ ! -d "$EXT_DIR" ]; then
    mkdir -p "$EXT_DIR"
    if [ $? -eq 0 ]; then
        echo "    作成しました: $EXT_DIR"
    else
        echo "    [エラー] フォルダ作成に失敗しました: $EXT_DIR"
        read -p "Enterキーで終了..."
        exit 1
    fi
else
    echo "    既に存在します: $EXT_DIR"
fi

echo ""
echo "[3/3] フォルダを Finder で開いています..."
open "$EXT_DIR"

echo ""
echo "============================================"
echo " セットアップ完了！"
echo ""
echo " 次の手順:"
echo " 1. 開いたフォルダに「SEPonDashi」フォルダを貼り付ける"
echo " 2. Premiere Pro を完全に終了して再起動する"
echo " 3. ウィンドウ → エクステンション → SEポン出しパネル"
echo "============================================"
echo ""
read -p "Enterキーで終了..."
