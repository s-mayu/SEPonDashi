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
    read -rp " Enterキーで閉じます..." _
    exit 0
fi

echo " Installed at: $DEST"
echo ""
echo " ----------------------------------------------------------------"
echo "  SEデータをどうしますか？"
echo " ----------------------------------------------------------------"
echo ""
echo "   1  Keep data（データをデスクトップにバックアップして削除）← 推奨"
echo "   2  Full delete（完全削除・元に戻せません）"
echo "   3  Cancel（キャンセル）"
echo ""
read -rp " 番号を入力してEnter (1 / 2 / 3): " CHOICE
echo ""

case "$CHOICE" in
    1)
        echo " SEデータをデスクトップにバックアップしています..."
        echo ""

        rm -rf "$BACKUP"
        mkdir -p "$BACKUP"

        # 新config保存先を優先（main.js v5以降）
        if [ -f "$NEW_CONFIG" ]; then
            cp "$NEW_CONFIG" "$BACKUP/config.json"
            echo " [1/3] config.json をバックアップしました（ユーザーデータ）"
        elif [ -f "$DEST/config/config.json" ]; then
            cp "$DEST/config/config.json" "$BACKUP/config.json"
            echo " [1/3] config.json をバックアップしました（拡張機能フォルダ）"
        else
            echo " [1/3] config.json が見つかりませんでした（スキップ）"
        fi

        if [ -d "$DEST/assets/audio" ]; then
            cp -R "$DEST/assets/audio" "$BACKUP/audio"
            echo " [2/3] 音声ファイルをバックアップしました"
        else
            echo " [2/3] 音声ファイルが見つかりませんでした（スキップ）"
        fi

        rm -rf "$DEST"
        if [ -d "$DEST" ]; then
            echo ""
            echo " [ERROR] 削除に失敗しました。"
            echo " Premiere Pro を終了してから再試行してください。"
            read -rp " Enterキーで閉じます..." _
            exit 1
        fi

        echo " [3/3] SEPonDashi を削除しました。"
        echo ""
        echo " ================================================================"
        echo "   アンインストール完了。"
        echo ""
        echo "   バックアップ場所: $BACKUP"
        echo ""
        echo "   再インストール後に復元する場合:"
        echo "     install.command を実行後、以下のファイルをコピーしてください"
        echo "     コピー元: $BACKUP/config.json"
        echo "     コピー先: $NEW_CONFIG"
        echo ""
        echo "   Premiere Pro を再起動してください。"
        echo " ================================================================"
        ;;
    2)
        echo " 警告: すべての SE データが完全に削除されます。"
        echo ""
        read -rp " 確認のため yes と入力してEnter: " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo " キャンセルしました。何も変更していません。"
            read -rp " Enterキーで閉じます..." _
            exit 0
        fi
        echo ""
        rm -rf "$DEST"
        if [ -d "$DEST" ]; then
            echo " [ERROR] 削除に失敗しました。"
            echo " Premiere Pro を終了してから再試行してください。"
            read -rp " Enterキーで閉じます..." _
            exit 1
        fi
        echo " SEPonDashi を完全削除しました。"
        echo ""
        echo " ================================================================"
        echo "   アンインストール完了。Premiere Pro を再起動してください。"
        echo " ================================================================"
        ;;
    *)
        echo " キャンセルしました。何も変更していません。"
        ;;
esac
echo ""
read -rp " Enterキーで閉じます..." _
