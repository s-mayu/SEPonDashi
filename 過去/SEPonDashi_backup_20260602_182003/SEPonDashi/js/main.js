/**
 * SEポン出しパネル - main.js v3
 * カテゴリタブ管理 + overwriteClip改善版
 * CEP 11 / Premiere Pro 2025・2026
 */

(function () {
  "use strict";

  var fs   = require("fs");
  var path = require("path");

  var csInterface = new CSInterface();
  var EXT_ROOT    = csInterface.getSystemPath(SystemPath.EXTENSION);
  var AUDIO_DIR   = path.join(EXT_ROOT, "assets", "audio");
  var CONFIG_PATH = path.join(EXT_ROOT, "config", "config.json");

  /* =========================================================
     DOM参照
  ========================================================= */
  var seGrid         = document.getElementById("se-grid");
  var dropZone       = document.getElementById("drop-zone");
  var logArea        = document.getElementById("log-area");
  var noSeMessage    = document.getElementById("no-se-message");
  var statusEl       = document.getElementById("status-indicator");
  var categoryTabs   = document.getElementById("category-tabs");
  var addCategoryBtn  = document.getElementById("add-category-btn");
  var viewToggleBtn   = document.getElementById("view-toggle-btn");
  var modalOverlay   = document.getElementById("modal-overlay");
  var modalInput     = document.getElementById("modal-input");
  var modalCancel    = document.getElementById("modal-cancel");
  var modalOk        = document.getElementById("modal-ok");

  /* =========================================================
     状態変数
  ========================================================= */
  var selectedTrackIndex   = 1;   // 1=A2, 2=A3, 3=A4, 4=A5
  var currentCategoryId    = "";  // 現在選択中のカテゴリID
  var viewMode             = "grid"; // "grid" | "list"
  var previewAudio         = null;   // 右クリック視聴用Audioインスタンス

  /* =========================================================
     ユーティリティ
  ========================================================= */
  function log(msg, type) {
    logArea.textContent = msg;
    logArea.className   = "log-area";
    if (type === "error")   logArea.classList.add("log-error");
    if (type === "success") logArea.classList.add("log-success");
    if (type === "warning") logArea.classList.add("log-warning");
  }

  function setStatus(msg, state) {
    statusEl.textContent = msg;
    statusEl.className   = "status-" + (state || "idle");
  }

  function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  function toForwardSlash(p) {
    return p.replace(/\\/g, "/");
  }

  function generateId(prefix) {
    return (prefix || "id") + "_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  /* =========================================================
     config管理
     スキーマ: { categories: [ { id, name, seList:[] } ] }
  ========================================================= */
  function loadConfig() {
    ensureDir(path.dirname(CONFIG_PATH));
    if (!fs.existsSync(CONFIG_PATH)) {
      return defaultConfig();
    }
    try {
      var raw    = fs.readFileSync(CONFIG_PATH, "utf8");
      var parsed = JSON.parse(raw);

      // 旧スキーマ（seList直下）を新スキーマへ自動移行
      if (parsed.seList && !parsed.categories) {
        var migrated = defaultConfig();
        migrated.categories[0].seList = parsed.seList;
        saveConfig(migrated);
        return migrated;
      }

      // categoriesが空・未定義なら初期値
      if (!parsed.categories || parsed.categories.length === 0) {
        return defaultConfig();
      }
      return parsed;
    } catch (e) {
      log("config.json 読み込み失敗: " + e.message, "error");
      return defaultConfig();
    }
  }

  function defaultConfig() {
    return {
      categories: [
        { id: "cat_default", name: "すべて", seList: [] }
      ]
    };
  }

  function saveConfig(config) {
    ensureDir(path.dirname(CONFIG_PATH));
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
    } catch (e) {
      log("config.json 保存失敗: " + e.message, "error");
    }
  }

  /* =========================================================
     現在カテゴリ取得
  ========================================================= */
  function getCurrentCategory(config) {
    for (var i = 0; i < config.categories.length; i++) {
      if (config.categories[i].id === currentCategoryId) {
        return config.categories[i];
      }
    }
    // 見つからなければ先頭を返す
    return config.categories[0];
  }

  /* =========================================================
     カテゴリタブ描画
  ========================================================= */
  function renderCategoryTabs(config) {
    categoryTabs.innerHTML = "";

    config.categories.forEach(function (cat) {
      var tab = document.createElement("div");
      tab.className  = "cat-tab" + (cat.id === currentCategoryId ? " active" : "");
      tab.dataset.id = cat.id;

      // タブ名（contenteditable でダブルクリック編集）
      var nameEl = document.createElement("span");
      nameEl.className       = "cat-tab-name";
      nameEl.textContent     = cat.name;
      nameEl.contentEditable = "false";

      nameEl.addEventListener("dblclick", function (e) {
        e.stopPropagation();
        nameEl.contentEditable = "true";
        nameEl.focus();
        // テキスト全選択
        var range = document.createRange();
        range.selectNodeContents(nameEl);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      });

      nameEl.addEventListener("blur", function () {
        nameEl.contentEditable = "false";
        var newName = nameEl.textContent.trim();
        if (!newName) { nameEl.textContent = cat.name; return; }
        var cfg = loadConfig();
        for (var j = 0; j < cfg.categories.length; j++) {
          if (cfg.categories[j].id === cat.id) {
            cfg.categories[j].name = newName;
            break;
          }
        }
        saveConfig(cfg);
        cat.name = newName;
        log("カテゴリ名を変更しました: " + newName, "info");
      });

      nameEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
        if (e.key === "Escape") { nameEl.textContent = cat.name; nameEl.blur(); }
      });

      // タブクリックでカテゴリ切り替え
      tab.addEventListener("click", function () {
        currentCategoryId = cat.id;
        var cfg = loadConfig();
        renderCategoryTabs(cfg);
        renderSEButtons(getCurrentCategory(cfg).seList);
      });

      // カテゴリタブをドロップターゲットにする
      tab.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        tab.classList.add("drop-target");
      });
      tab.addEventListener("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!tab.contains(e.relatedTarget)) {
          tab.classList.remove("drop-target");
        }
      });
      tab.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        tab.classList.remove("drop-target");
        var seId = e.dataTransfer.getData("text/plain");
        if (seId && cat.id !== currentCategoryId) {
          moveSEToCategory(seId, cat.id);
        }
      });

      // 削除ボタン（デフォルトカテゴリは削除不可）
      if (cat.id !== "cat_default") {
        var delBtn = document.createElement("button");
        delBtn.className   = "cat-tab-delete";
        delBtn.textContent = "×";
        delBtn.title       = "カテゴリ削除";
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          removeCategory(cat.id);
        });
        tab.appendChild(nameEl);
        tab.appendChild(delBtn);
      } else {
        tab.appendChild(nameEl);
      }

      categoryTabs.appendChild(tab);
    });
  }

  /* =========================================================
     カテゴリ追加
  ========================================================= */
  addCategoryBtn.addEventListener("click", function () {
    modalInput.value = "";
    modalOverlay.classList.remove("hidden");
    setTimeout(function () { modalInput.focus(); }, 50);
  });

  modalCancel.addEventListener("click", function () {
    modalOverlay.classList.add("hidden");
  });

  modalOk.addEventListener("click", function () {
    commitAddCategory();
  });

  modalInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter")  { commitAddCategory(); }
    if (e.key === "Escape") { modalOverlay.classList.add("hidden"); }
  });

  function commitAddCategory() {
    var name = modalInput.value.trim();
    if (!name) { log("カテゴリ名を入力してください。", "warning"); return; }
    modalOverlay.classList.add("hidden");

    var cfg   = loadConfig();
    var newId = generateId("cat");
    cfg.categories.push({ id: newId, name: name, seList: [] });
    saveConfig(cfg);

    currentCategoryId = newId;
    renderCategoryTabs(cfg);
    renderSEButtons([]);
    log("カテゴリ「" + name + "」を追加しました。", "success");
  }

  /* =========================================================
     カテゴリ削除
  ========================================================= */
  function removeCategory(catId) {
    var cfg = loadConfig();
    cfg.categories = cfg.categories.filter(function (c) { return c.id !== catId; });
    if (cfg.categories.length === 0) {
      cfg.categories = [{ id: "cat_default", name: "すべて", seList: [] }];
    }
    saveConfig(cfg);

    // 削除されたカテゴリを選択中だった場合は先頭へ
    if (currentCategoryId === catId) {
      currentCategoryId = cfg.categories[0].id;
    }
    renderCategoryTabs(cfg);
    renderSEButtons(getCurrentCategory(cfg).seList);
    log("カテゴリを削除しました。", "info");
  }

  /* =========================================================
     SEボタン描画
  ========================================================= */
  function renderSEButtons(seList) {
    seGrid.innerHTML = "";
    seGrid.className = viewMode === "list" ? "se-list" : "se-grid";

    if (!seList || seList.length === 0) {
      noSeMessage.classList.add("visible");
      return;
    }
    noSeMessage.classList.remove("visible");

    seList.forEach(function (se) {
      var btn       = document.createElement("button");
      btn.className  = viewMode === "list" ? "se-btn se-btn-list" : "se-btn";
      btn.dataset.id = se.id;
      btn.title      = se.fullPath;

      var icon = document.createElement("span");
      icon.className   = "se-btn-icon";
      icon.textContent = "▶";

      var label = document.createElement("span");
      label.className   = "se-btn-name";
      label.textContent = se.displayName;

      var delBtn = document.createElement("button");
      delBtn.className   = "se-btn-delete";
      delBtn.textContent = "×";
      delBtn.title       = "削除";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeSE(se.id);
      });

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(delBtn);

      btn.addEventListener("click", function () {
        placeSEToTimeline(se);
      });

      // 右クリックで視聴プレビュー
      btn.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        e.stopPropagation();
        previewSE(se, btn);
      });

      // カテゴリ間ドラッグ用
      btn.draggable = true;
      btn.addEventListener("dragstart", function (e) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", se.id);
        btn.classList.add("dragging");
      });
      btn.addEventListener("dragend", function () {
        btn.classList.remove("dragging");
        btn.classList.remove("was-previewing");
        document.querySelectorAll(".cat-tab").forEach(function (t) {
          t.classList.remove("drop-target");
        });
      });

      seGrid.appendChild(btn);
    });
  }

  /* =========================================================
     右クリック視聴（プレビュー）
  ========================================================= */
  function previewSE(se, btn) {
    // 再生中の音声を停止
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      // 再生中ボタンのスタイルをリセット
      var prevBtn = seGrid.querySelector(".previewing");
      if (prevBtn) { prevBtn.classList.remove("previewing"); }
      previewAudio = null;
    }

    // 同じSEを再度右クリックした場合は停止のみ
    if (btn.classList.contains("was-previewing")) {
      btn.classList.remove("was-previewing");
      log("視聴停止。", "info");
      return;
    }

    // ファイルの存在確認
    if (!fs.existsSync(se.fullPath)) {
      log("ファイルが見つかりません: " + se.fullPath, "error");
      return;
    }

    try {
      var filePath = se.fullPath.replace(/\\/g, "/");
      var audio = new Audio("file:///" + filePath);
      audio.addEventListener("ended", function () {
        btn.classList.remove("previewing");
        btn.classList.remove("was-previewing");
        previewAudio = null;
        log("視聴完了: 「" + se.displayName + "」", "info");
      });
      audio.addEventListener("error", function () {
        btn.classList.remove("previewing");
        previewAudio = null;
        log("視聴エラー: 「" + se.displayName + "」", "error");
      });
      audio.play();
      previewAudio = audio;
      btn.classList.add("previewing");
      btn.classList.add("was-previewing");
      log("視聴中: 「" + se.displayName + "」（右クリックで停止）", "info");
    } catch (e) {
      log("視聴失敗: " + e.message, "error");
    }
  }

  /* =========================================================
     SEをカテゴリ間で移動
  ========================================================= */
  function moveSEToCategory(seId, destCatId) {
    var cfg     = loadConfig();
    var srcCat  = getCurrentCategory(cfg);
    var destCat = null;
    for (var i = 0; i < cfg.categories.length; i++) {
      if (cfg.categories[i].id === destCatId) {
        destCat = cfg.categories[i];
        break;
      }
    }
    if (!destCat) { log("移動先カテゴリが見つかりません。", "error"); return; }

    // 移動元から該当SEを取り出す
    var target = null;
    srcCat.seList = srcCat.seList.filter(function (se) {
      if (se.id === seId) { target = se; return false; }
      return true;
    });

    if (!target) { log("移動するSEが見つかりません。", "error"); return; }

    // 移動先に既に同パスが登録されていればスキップ
    var already = destCat.seList.some(function (se) { return se.fullPath === target.fullPath; });
    if (already) {
      log("「" + target.displayName + "」は移動先に既に登録されています。", "warning");
      // 元カテゴリから削除だけ済んでいるので戻す
      srcCat.seList.push(target);
      return;
    }

    destCat.seList.push(target);
    saveConfig(cfg);
    renderCategoryTabs(cfg);
    renderSEButtons(srcCat.seList);
    log("「" + target.displayName + "」を「" + destCat.name + "」へ移動しました。", "success");
  }

  /* =========================================================
     SE削除（現在カテゴリから）
  ========================================================= */
  function removeSE(seId) {
    var cfg  = loadConfig();
    var cat  = getCurrentCategory(cfg);
    cat.seList = cat.seList.filter(function (se) { return se.id !== seId; });
    saveConfig(cfg);
    renderSEButtons(cat.seList);
    log("SEを削除しました。", "info");
  }

  /* =========================================================
     トラック選択
  ========================================================= */
  var trackBtns = document.querySelectorAll(".track-btn");
  trackBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedTrackIndex = parseInt(btn.dataset.track, 10);
      trackBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      log("配置先: A" + (selectedTrackIndex + 1), "info");
    });
  });

  /* =========================================================
     表示切り替え（グリッド ⇔ リスト）
  ========================================================= */
  if (viewToggleBtn) {
    viewToggleBtn.addEventListener("click", function () {
      viewMode = viewMode === "grid" ? "list" : "grid";
      viewToggleBtn.textContent = viewMode === "list" ? "⊞" : "☰";
      viewToggleBtn.title       = viewMode === "list" ? "グリッド表示" : "リスト表示";
      var cfg = loadConfig();
      renderSEButtons(getCurrentCategory(cfg).seList);
    });
  }

  /* =========================================================
     Premiere Proへの配置
  ========================================================= */
  function placeSEToTimeline(se) {
    if (!fs.existsSync(se.fullPath)) {
      log("ファイルが見つかりません: " + se.fullPath, "error");
      setStatus("エラー", "error");
      return;
    }

    setStatus("配置中...", "busy");
    log("「" + se.displayName + "」→ A" + (selectedTrackIndex + 1) + " ...", "info");

    var safePath = toForwardSlash(se.fullPath);
    // パスと数値を安全にExtendScriptへ渡す
    var script = 'placeSEOnTimeline("'
      + safePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
      + '",' + selectedTrackIndex + ')';

    csInterface.evalScript(script, function (result) {
      if (!result || result === "EvalScript error.") {
        log("ExtendScript呼び出し失敗（evalScript error）", "error");
        setStatus("エラー", "error");
        return;
      }

      if (result.indexOf("ERR:") === 0) {
        log("配置失敗: " + result.substring(4), "error");
        setStatus("エラー", "error");
      } else {
        log("「" + se.displayName + "」を " + result.replace("OK:", "") + " に配置しました。", "success");
        setStatus("配置完了", "ok");
        flashButton(se.id);
      }
    });
  }

  function flashButton(seId) {
    var btn = seGrid.querySelector('[data-id="' + seId + '"]');
    if (btn) {
      btn.classList.add("playing");
      setTimeout(function () { btn.classList.remove("playing"); }, 600);
    }
  }

  /* =========================================================
     ドラッグ＆ドロップ
  ========================================================= */
  ["dragover", "drop", "dragenter", "dragleave"].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); });
  });

  dropZone.addEventListener("dragenter", function (e) {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault(); e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove("drag-over");
    }
  });
  dropZone.addEventListener("drop", function (e) {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove("drag-over");

    var files = e.dataTransfer.files;
    if (!files || files.length === 0) { log("ファイルを検出できませんでした。", "warning"); return; }

    var cfg     = loadConfig();
    var cat     = getCurrentCategory(cfg);
    var added   = 0, skipped = 0;
    var errors  = [];

    for (var i = 0; i < files.length; i++) {
      var res = handleDroppedFile(files[i], cat);
      if (res === "added")        { added++; }
      else if (res === "skipped") { skipped++; }
      else                        { errors.push(res); }
    }

    saveConfig(cfg);
    renderSEButtons(cat.seList);

    var msg = "";
    if (added   > 0) { msg += added + "件追加。"; }
    if (skipped > 0) { msg += skipped + "件スキップ（既登録）。"; }
    if (errors.length > 0) { msg += "エラー: " + errors.join(" / "); }
    if (!msg) { msg = "追加できるファイルがありませんでした。"; }
    log(msg, errors.length > 0 ? "warning" : "success");
  });

  function handleDroppedFile(file, cat) {
    var ext = path.extname(file.name).toLowerCase();
    if (ext !== ".wav" && ext !== ".mp3") {
      return "非対応形式: " + file.name;
    }

    var srcPath = file.path;
    if (!srcPath || !fs.existsSync(srcPath)) {
      return "パス取得失敗: " + file.name;
    }

    ensureDir(AUDIO_DIR);
    var destPath = path.join(AUDIO_DIR, file.name);

    // assets/audio/ に同名ファイルが既にあればスキップ（プロマネ流用時も対応）
    if (fs.existsSync(destPath)) { return "skipped"; }

    // ファイルコピー
    var finalDest = destPath;
    try {
      fs.writeFileSync(destPath, fs.readFileSync(srcPath));
    } catch (e) {
      return "コピー失敗: " + file.name + " (" + e.message + ")";
    }

    cat.seList.push({
      id:          generateId("se"),
      displayName: path.basename(file.name, ext),
      fileName:    file.name,
      fullPath:    finalDest
    });

    return "added";
  }

  /* =========================================================
     初期化
  ========================================================= */
  function init() {
    try { ensureDir(AUDIO_DIR); } catch (e) {
      log("audioフォルダ作成失敗: " + e.message, "error");
    }

    var cfg = loadConfig();

    // 存在しないファイルをすべてのカテゴリから除去
    var cleaned = false;
    cfg.categories.forEach(function (cat) {
      var before = cat.seList.length;
      cat.seList = cat.seList.filter(function (se) { return fs.existsSync(se.fullPath); });
      if (cat.seList.length !== before) { cleaned = true; }
    });
    if (cleaned) {
      saveConfig(cfg);
      log("存在しないSEをconfigから除去しました。", "warning");
    }

    // トラックボタンのUIをデフォルト（A2）に合わせる
    trackBtns.forEach(function (b) {
      b.classList.remove("active");
      if (parseInt(b.dataset.track, 10) === selectedTrackIndex) {
        b.classList.add("active");
      }
    });

    // 先頭カテゴリを選択
    currentCategoryId = cfg.categories[0].id;
    renderCategoryTabs(cfg);
    renderSEButtons(getCurrentCategory(cfg).seList);

    setStatus("待機中", "idle");
    log("SEポン出しパネル 起動完了。", "info");
  }

  init();

})();