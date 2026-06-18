# SEポン出し（SEPonDashi） — 作成の流れと導入手順

---

## 目次

1. [概要](#概要)
2. [技術構成](#技術構成)
3. [作成の流れ](#作成の流れ)
4. [ファイル構成](#ファイル構成)
5. [導入手順 — Windows](#導入手順--windows)
6. [導入手順 — macOS](#導入手順--macos)
7. [よくある質問](#よくある質問)

---

## 概要

**SEポン出し（SEPonDashi）** は Adobe Premiere Pro 上で動作する効果音ポン出しパネルです。  
WAV / MP3 ファイルをあらかじめ登録しておき、ボタンひとつで再生ヘッドの位置にタイムライン配置できます。

| 項目 | 内容 |
|---|---|
| 対応 OS | Windows 10 / 11、macOS 12 以降 |
| 対応アプリ | Adobe Premiere Pro 2025 / 2026（v25.0 以上） |
| 種別 | CEP 拡張機能（パネル） |
| 対応フォーマット | WAV / MP3 |

---

## 技術構成

```
┌─────────────────────────────────┐
│  Premiere Pro（ホストアプリ）      │
│  ┌───────────────────────────┐  │
│  │  CEP パネル（Chromium）    │  │
│  │  HTML / CSS / JavaScript  │  │
│  │  Node.js（ファイル操作）   │  │
│  └──────────┬────────────────┘  │
│             │ evalScript         │
│  ┌──────────▼────────────────┐  │
│  │  ExtendScript エンジン     │  │
│  │  hostscript.jsx            │  │
│  │  （タイムライン操作）      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

| レイヤー | ファイル | 役割 |
|---|---|---|
| パネル UI | `index.html` / `style.css` | ボタン・カテゴリ・検索バーの画面 |
| パネルロジック | `main.js` | SE登録・再生・config管理 |
| Premiere Pro 連携 | `hostscript.jsx` | タイムラインへのクリップ配置 |
| CEP API | `lib/CSInterface.js` | JS ↔ ExtendScript 橋渡し |
| 拡張機能定義 | `CSXS/manifest.xml` | プラグイン情報・対応バージョン |

---

## 作成の流れ

### STEP 1 — CEP 拡張機能の構造設計

CEP（Common Extensibility Platform）は Adobe CC アプリ上で動作する拡張機能の仕組みです。  
パネルは Chromium ベースのウェブページとして動作し、Node.js と ExtendScript を通じてアプリ本体を操作します。

```
CEP拡張機能 = ウェブページ（HTML/JS/CSS）
                + Node.js（ファイル操作）
                + ExtendScript（Premiere Pro API）
```

---

### STEP 2 — manifest.xml の作成

拡張機能の ID、対応バージョン、パネルサイズなどを定義します。

```xml
<ExtensionManifest
  ExtensionBundleId="com.example.sepondashi"
  Version="12.0">
  <HostList>
    <Host Name="PPRO" Version="[25.0,27.0]"/>
  </HostList>
  <CEFCommandLine>
    <Parameter>--enable-nodejs</Parameter>
  </CEFCommandLine>
</ExtensionManifest>
```

- `Host Name="PPRO"` で Premiere Pro を対象に指定
- `--enable-nodejs` で Node.js を有効化し、ファイル操作を可能にする

---

### STEP 3 — パネル UI の作成（index.html / style.css）

Premiere Pro のダークテーマに合わせた UI を HTML/CSS で構築します。

**主な UI 要素**

| 要素 | 機能 |
|---|---|
| トラック選択ボタン（A2〜A5） | 配置先オーディオトラックの選択 |
| カテゴリタブ | SE をグループ分けして管理 |
| SE ボタングリッド | クリックで配置、右クリックで試聴 |
| ドロップゾーン | ファイルをドラッグ＆ドロップして登録 |
| 検索バー | SE 名でリアルタイム絞り込み |
| ログエリア | 操作結果・エラーを表示 |

---

### STEP 4 — メインロジックの実装（main.js）

CEP パネル内の JavaScript で SE 管理・UI 制御を実装します。

**主な機能**

- **config 管理**  
  登録 SE・カテゴリ情報を `config.json` に保存・読み込み  
  保存先: `%APPDATA%\SEPonDashi\` (Windows) / `~/Library/Application Support/SEPonDashi/` (macOS)

- **ファイルドロップ**  
  ドロップされた WAV/MP3 を `assets/audio/` にコピーして登録

- **SE 配置**  
  `csInterface.evalScript()` を経由して ExtendScript の `placeSEOnTimeline()` を呼び出す

- **試聴（右クリック）**  
  Web Audio API（`new Audio()`）でローカルファイルを再生

- **スキーマ移行**  
  旧バージョンの config 形式を自動的に新形式へ変換

---

### STEP 5 — Premiere Pro 連携の実装（hostscript.jsx）

ExtendScript（Adobe 独自の JavaScript 実装）で Premiere Pro の API を操作します。

```javascript
function placeSEOnTimeline(filePath, audioTrackIndex) {
  // 1. プロジェクトパネルにファイルをインポート
  app.project.importFiles([filePath], ...);

  // 2. ターゲット以外のトラックをロック
  audioTracks[i].setLocked(i !== audioTrackIndex);

  // 3. 再生ヘッド位置にクリップを配置
  seq.overwriteClip(projectItem, ctiTime, ...);
}
```

**配置ロジック（3段フォールバック）**

| 試行 | 方法 |
|---|---|
| 1st | `seq.overwriteClip()` |
| 2nd | `seq.insertClip()` |
| 3rd | ソースモニター経由 |

---

### STEP 6 — インストーラーの作成

**Windows（install.bat）**

1. レジストリに `PlayerDebugMode = 1` を設定  
   → 署名なし拡張機能を Premiere Pro が読み込めるようにする
2. 拡張機能ファイルを `%APPDATA%\Adobe\CEP\extensions\SEPonDashi\` にコピー

**macOS（install.command）**

1. `defaults write com.adobe.CSXS.12 PlayerDebugMode 1` を実行
2. 拡張機能ファイルを `~/Library/Application Support/Adobe/CEP/extensions/SEPonDashi/` にコピー

**アップデート設計**

- コードファイル（js / jsx / css / CSXS / lib）のみ上書き
- `config.json`（SE リスト）と音声ファイルは**一切触らない**

---

### STEP 7 — パッケージング・配布

OS 別に別パッケージとして配布します。

```
SEPonDashi_Windows.zip  →  Windows ユーザー向け
SEPonDashi_Mac.zip      →  macOS ユーザー向け
```

> **注意**: `SEPonDashi_Mac.zip` は必ず macOS 上で作成してください。  
> Windows で ZIP を作成すると `.command` ファイルの実行権限が失われます。

---

## ファイル構成

```
SEPonDashi/
├── CSXS/
│   └── manifest.xml        拡張機能の定義ファイル
├── assets/
│   └── audio/              登録した音声ファイルの保存先（初期は空）
├── config/
│   └── config.json         デフォルト設定（初回インストール時のみ使用）
├── css/
│   └── style.css           パネルのスタイル
├── js/
│   └── main.js             パネルのメインロジック
├── jsx/
│   └── hostscript.jsx      Premiere Pro 操作スクリプト
├── lib/
│   └── CSInterface.js      CEP 公式 API ライブラリ
└── index.html              パネルの HTML
```

**ユーザーデータの保存先（拡張機能フォルダとは別）**

| OS | パス |
|---|---|
| Windows | `%APPDATA%\SEPonDashi\config.json` |
| macOS | `~/Library/Application Support/SEPonDashi/config.json` |

---

## 導入手順 — Windows

### 初回インストール

1. `SEPonDashi_Windows.zip` を展開する
2. `install.bat` をダブルクリックする

   > 「Windows によって PC が保護されました」と表示された場合  
   > → 「詳細情報」→「実行」をクリック

3. `INSTALLED` と表示されたら成功
4. Premiere Pro を再起動する
5. 「ウィンドウ」→「エクステンション」→「SEポン出し」でパネルを開く

### アップデート

1. 新しい `SEPonDashi_Windows.zip` を展開する
2. `install.bat` をダブルクリックする
3. `UPDATED - SE data has been preserved.` と表示されたら成功
4. Premiere Pro を再起動する

> 登録済みの SE・カテゴリは保持されます。

### アンインストール

1. `uninstall.bat` をダブルクリックする
2. `1 Keep data`（推奨）または `2 Full delete` を選択する
3. Premiere Pro を再起動する

---

## 導入手順 — macOS

### 初回インストール

1. `SEPonDashi_Mac.zip` を展開する
2. `install.command` を **右クリック → 「開く」** を選択する

   > 「開発元を確認できない」と表示された場合  
   > → 警告ダイアログの「開く」をクリック（初回のみ）

3. `INSTALLED` と表示されたら成功（Enter で閉じる）
4. Premiere Pro を再起動する
5. 「ウィンドウ」→「エクステンション」→「SEポン出し」でパネルを開く

### アップデート

1. 新しい `SEPonDashi_Mac.zip` を展開する
2. `install.command` を右クリック → 「開く」
3. `UPDATED - SE data has been preserved.` と表示されたら成功
4. Premiere Pro を再起動する

> 登録済みの SE・カテゴリは保持されます。

### アンインストール

1. `uninstall.command` を右クリック → 「開く」
2. `1 Keep data`（推奨）または `2 Full delete` を選択する
3. Premiere Pro を再起動する

---

## よくある質問

**Q. パネルが「ウィンドウ → エクステンション」に表示されない**  
A. `install.bat`（または `install.command`）を再実行し、Premiere Pro を完全終了してから再起動してください。

**Q. 効果音をクリックしてもタイムラインに配置されない**  
A. Premiere Pro でシーケンスが開いているか確認してください。また、選択中のトラック（A2〜A5）がそのシーケンスに存在するか確認してください。

**Q. アップデートしたら SE が消えた**  
A. 別フォルダに展開した ZIP のインストーラーを実行した可能性があります。`uninstall`（Keep data）でアンインストール後、再インストールし、バックアップの `config.json` を復元してください。

**Q. Mac で `install.command` をダブルクリックするとテキストが開く**  
A. 右クリック → 「開く」を選択してください。初回のセキュリティ確認が完了すると、以降はダブルクリックで実行できます。
