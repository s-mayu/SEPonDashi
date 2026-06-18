/**
 * SEポン出しパネル - main.js v5
 * masterSEList管理 + 複数カテゴリ参照 + 登録エリアトグル
 * CEP 11 / Premiere Pro 2025・2026
 */

(function () {
  "use strict";

  var fs   = require("fs");
  var path = require("path");

  var csInterface = new CSInterface();
  var EXT_ROOT    = csInterface.getSystemPath(SystemPath.EXTENSION);
  var AUDIO_DIR   = path.join(EXT_ROOT, "assets", "audio");

  // ユーザーデータ（config.json）は拡張機能フォルダ外のAppDataに保存する。
  // これによりアップデートで拡張機能フォルダを上書きしても設定が消えない。
  var APPDATA_BASE  = process.env.APPDATA                                          // Windows
                   || path.join(process.env.HOME || "", "Library", "Application Support"); // Mac
  var USER_DATA_DIR = path.join(APPDATA_BASE, "SEPonDashi");
  var CONFIG_PATH   = path.join(USER_DATA_DIR, "config.json");

  // v4以前の旧パス（初回アップデート時にここから移行する）
  var LEGACY_CONFIG_PATH = path.join(EXT_ROOT, "config", "config.json");

  /* =========================================================
     DOM参照
  ========================================================= */
  var seGrid         = document.getElementById("se-grid");
  var dropZone       = document.getElementById("drop-zone");
  var dropZoneWrap   = document.getElementById("drop-zone-wrap");
  var dropToggleBtn  = document.getElementById("drop-toggle-btn");
  var logArea        = document.getElementById("log-area");
  var noSeMessage    = document.getElementById("no-se-message");
  var statusEl       = document.getElementById("status-indicator");
  var categoryTabs   = document.getElementById("category-tabs");
  var addCategoryBtn = document.getElementById("add-category-btn");
  var viewToggleBtn  = document.getElementById("view-toggle-btn");
  var modalOverlay   = document.getElementById("modal-overlay");
  var modalInput     = document.getElementById("modal-input");
  var modalCancel    = document.getElementById("modal-cancel");
  var modalOk        = document.getElementById("modal-ok");
  var searchInput    = document.getElementById("search-input");

  /* =========================================================
     状態変数
  ========================================================= */
  var selectedTrackIndex = 1;      // 1=A2, 2=A3, 3=A4, 4=A5
  var currentCategoryId  = "";     // 現在選択中のカテゴリID
  var viewMode           = "grid"; // "grid" | "list"
  var previewAudio       = null;   // 右クリック視聴用Audioインスタンス
  var searchQuery        = "";     // 検索文字列（小文字）
  var dragSourceCatId    = "";     // ドラッグ開始時のカテゴリID
  var dropZoneOpen       = false;  // 登録エリアの表示状態

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
     ヘルパー
  ========================================================= */
  function findSEById(config, seId) {
    for (var i = 0; i < config.masterSEList.length; i++) {
      if (config.masterSEList[i].id === seId) return config.masterSEList[i];
    }
    return null;
  }

  function findCategoryById(config, catId) {
    for (var i = 0; i < config.categories.length; i++) {
      if (config.categories[i].id === catId) return config.categories[i];
    }
    return null;
  }

  function getSECategoryNames(config, seId) {
    var names = [];
    config.categories.forEach(function (cat) {
      if (cat.id === "cat_default") return;
      if (cat.seIds && cat.seIds.indexOf(seId) !== -1) {
        names.push(cat.name);
      }
    });
    return names;
  }

  /* =========================================================
     config管理
     スキーマ v5: { masterSEList: [], categories: [ { id, name, seIds?: [] } ] }
     cat_default (すべて) は seIds を持たない — masterSEList全体を表示
  ========================================================= */
  function defaultConfig() {
    return {
      masterSEList: [],
      categories: [
        { id: "cat_default", name: "すべて" }
      ]
    };
  }

  function needsMigration(parsed) {
    if (parsed.masterSEList) return false;
    if (!parsed.categories || parsed.categories.length === 0) return false;
    for (var i = 0; i < parsed.categories.length; i++) {
      if (parsed.categories[i].seList) return true;
    }
    return false;
  }

  function migrateConfig(parsed) {
    var masterSEList = [];
    var seByPath     = {};
    var newCategories = [];

    parsed.categories.forEach(function (cat) {
      var newCat = { id: cat.id, name: cat.name };
      if (cat.id !== "cat_default") {
        newCat.seIds = [];
      }
      newCategories.push(newCat);

      var seList = cat.seList || [];
      seList.forEach(function (se) {
        var existing = seByPath[se.fullPath];
        if (!existing) {
          var entry = {
            id:          se.id,
            displayName: se.displayName,
            fileName:    se.fileName,
            fullPath:    se.fullPath
          };
          masterSEList.push(entry);
          seByPath[se.fullPath] = entry;
          existing = entry;
        }
        if (cat.id !== "cat_default") {
          if (newCat.seIds.indexOf(existing.id) === -1) {
            newCat.seIds.push(existing.id);
          }
        }
      });
    });

    return { masterSEList: masterSEList, categories: newCategories };
  }

  function loadConfig() {
    ensureDir(USER_DATA_DIR);

    // ① 旧パス（拡張機能フォルダ内）にデータがあれば新パスへ移行（初回アップデート時のみ）
    if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(LEGACY_CONFIG_PATH)) {
      try {
        var legacyRaw = fs.readFileSync(LEGACY_CONFIG_PATH, "utf8");
        var legacyParsed = JSON.parse(legacyRaw);
        // 旧パスの内容が空のデフォルトだけなら移行せず新規扱い
        var hasData = legacyParsed.masterSEList
          ? legacyParsed.masterSEList.length > 0
          : (legacyParsed.categories || []).some(function(c) {
              return (c.seList || []).length > 0;
            });
        if (hasData) {
          fs.writeFileSync(CONFIG_PATH, legacyRaw, "utf8");
          // 旧ファイルを .migrated にリネームして残す（バックアップ）
          try { fs.renameSync(LEGACY_CONFIG_PATH, LEGACY_CONFIG_PATH + ".migrated"); } catch (re) {
            // リネーム失敗時はそのまま残す（次回起動時は新パスが優先）
          }
        }
      } catch (me) {
        log("旧設定の移行に失敗しました: " + me.message, "warning");
      }
    }

    if (!fs.existsSync(CONFIG_PATH)) {
      return defaultConfig();
    }
    try {
      var raw    = fs.readFileSync(CONFIG_PATH, "utf8");
      var parsed = JSON.parse(raw);

      // 最古のスキーマ（seList直下）を一段階正規化
      if (parsed.seList && !parsed.categories) {
        parsed = { categories: [{ id: "cat_default", name: "すべて", seList: parsed.seList }] };
      }

      // v4以前スキーマ（categories[].seList）を v5へ移行
      if (needsMigration(parsed)) {
        // 移行前に元データをバックアップ保存
        var backupPath = CONFIG_PATH + ".bak";
        try {
          fs.writeFileSync(backupPath, raw, "utf8");
        } catch (be) {
          // バックアップ失敗は無視して移行を続行
        }

        var migrated = migrateConfig(parsed);
        saveConfig(migrated);

        var seCount  = migrated.masterSEList.length;
        var catCount = migrated.categories.length - 1; // すべてを除く
        log("データ移行完了: SE " + seCount + "件、カテゴリ " + catCount + "件を保持しました。", "success");
        return migrated;
      }

      if (!parsed.categories || parsed.categories.length === 0) {
        return defaultConfig();
      }
      // masterSEListが欠落しているv5未完成データを補完して保存
      if (!parsed.masterSEList) {
        parsed.masterSEList = [];
        saveConfig(parsed);
      }
      return parsed;
    } catch (e) {
      log("config.json 読み込み失敗: " + e.message, "error");
      return defaultConfig();
    }
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
    return findCategoryById(config, currentCategoryId) || config.categories[0];
  }

  /* =========================================================
     表示用SEリスト取得
     cat_default（すべて）→ masterSEList をそのまま返す（順番保持）
     その他カテゴリ    → seIds 順に masterSEList から引く
  ========================================================= */
  function getDisplaySEList(config) {
    if (currentCategoryId === "cat_default") {
      return config.masterSEList.map(function (se) {
        var catNames = getSECategoryNames(config, se.id);
        return {
          id:             se.id,
          displayName:    se.displayName,
          fileName:       se.fileName,
          fullPath:       se.fullPath,
          _sourceCatId:   "cat_default",
          _sourceCatName: catNames.join(", ")
        };
      });
    }

    var cat   = getCurrentCategory(config);
    var seIds = cat.seIds || [];
    var result = [];
    seIds.forEach(function (id) {
      var se = findSEById(config, id);
      if (se) {
        result.push({
          id:             se.id,
          displayName:    se.displayName,
          fileName:       se.fileName,
          fullPath:       se.fullPath,
          _sourceCatId:   cat.id,
          _sourceCatName: ""
        });
      }
    });
    return result;
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

      var nameEl = document.createElement("span");
      nameEl.className       = "cat-tab-name";
      nameEl.textContent     = cat.name;
      nameEl.contentEditable = "false";

      nameEl.addEventListener("dblclick", function (e) {
        e.stopPropagation();
        nameEl.contentEditable = "true";
        nameEl.focus();
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
        var c = findCategoryById(cfg, cat.id);
        if (c) { c.name = newName; }
        saveConfig(cfg);
        cat.name = newName;
        log("カテゴリ名を変更しました: " + newName, "info");
      });

      nameEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter")  { e.preventDefault(); nameEl.blur(); }
        if (e.key === "Escape") { nameEl.textContent = cat.name; nameEl.blur(); }
      });

      tab.addEventListener("click", function () {
        currentCategoryId = cat.id;
        searchQuery = "";
        if (searchInput) { searchInput.value = ""; }
        var cfg = loadConfig();
        renderCategoryTabs(cfg);
        renderSEButtons(getDisplaySEList(cfg));
      });

      // すべてタブはドロップターゲットにしない
      if (cat.id !== "cat_default") {
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
          if (seId && cat.id !== dragSourceCatId) {
            moveSEToCategory(seId, cat.id);
          }
        });
      }

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
    cfg.categories.push({ id: newId, name: name, seIds: [] });
    saveConfig(cfg);

    currentCategoryId = newId;
    renderCategoryTabs(cfg);
    renderSEButtons([]);
    log("カテゴリ「" + name + "」を追加しました。", "success");
  }

  /* =========================================================
     カテゴリ削除（seIds参照のみ削除、masterSEListは保持）
  ========================================================= */
  function removeCategory(catId) {
    var cfg = loadConfig();
    cfg.categories = cfg.categories.filter(function (c) { return c.id !== catId; });
    if (cfg.categories.length === 0) {
      cfg.categories = [{ id: "cat_default", name: "すべて" }];
    }
    saveConfig(cfg);

    if (currentCategoryId === catId) {
      currentCategoryId = cfg.categories[0].id;
    }
    renderCategoryTabs(cfg);
    renderSEButtons(getDisplaySEList(cfg));
    log("カテゴリを削除しました（SEデータは「すべて」に保持されています）。", "info");
  }

  /* =========================================================
     SEボタン描画
  ========================================================= */
  function renderSEButtons(seList) {
    var filtered = seList;
    if (searchQuery) {
      filtered = seList.filter(function (se) {
        return se.displayName.toLowerCase().indexOf(searchQuery) !== -1;
      });
    }

    seGrid.innerHTML = "";
    seGrid.className = viewMode === "list" ? "se-list" : "se-grid";

    if (!filtered || filtered.length === 0) {
      noSeMessage.classList.add("visible");
      if (searchQuery && seList.length > 0) {
        noSeMessage.textContent = "「" + searchQuery + "」に一致するSEが見つかりません。";
      } else if (currentCategoryId === "cat_default") {
        noSeMessage.innerHTML =
          "SEが登録されていません。<br/>下のエリアにファイルをドロップしてください。";
      } else {
        noSeMessage.innerHTML =
          "このカテゴリにSEがありません。<br/>「すべて」タブからSEをドラッグして追加するか、<br/>ファイルをドロップしてください。";
      }
      return;
    }
    noSeMessage.classList.remove("visible");

    var isAllView = (currentCategoryId === "cat_default");

    filtered.forEach(function (se) {
      var btn = document.createElement("button");
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
      delBtn.title       = isAllView ? "マスターから完全削除" : "このカテゴリから外す";
      delBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeSE(se.id, se._sourceCatId);
      });

      btn.appendChild(icon);
      btn.appendChild(label);
      btn.appendChild(delBtn);

      // すべてビューではカテゴリバッジを表示
      if (isAllView && se._sourceCatName) {
        var badge = document.createElement("span");
        badge.className   = "se-btn-cat-badge";
        badge.textContent = se._sourceCatName;
        btn.appendChild(badge);
      }

      btn.addEventListener("click", function () {
        placeSEToTimeline(se);
      });

      btn.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        e.stopPropagation();
        previewSE(se, btn);
      });

      btn.draggable = true;
      btn.addEventListener("dragstart", function (e) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", se.id);
        dragSourceCatId = currentCategoryId;
        btn.classList.add("dragging");
      });
      btn.addEventListener("dragend", function () {
        btn.classList.remove("dragging");
        btn.classList.remove("was-previewing");
        dragSourceCatId = "";
        document.querySelectorAll(".cat-tab").forEach(function (t) {
          t.classList.remove("drop-target");
        });
        document.querySelectorAll(".se-btn").forEach(function (b) {
          b.classList.remove("drop-before", "drop-after");
        });
      });

      // 並び替え: dragover でインジケータ表示（同カテゴリのみ）
      btn.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragSourceCatId || dragSourceCatId !== currentCategoryId) return;
        var rect     = btn.getBoundingClientRect();
        var isBefore = viewMode === "list"
          ? e.clientY < rect.top + rect.height / 2
          : e.clientX < rect.left + rect.width / 2;
        btn.classList.remove("drop-before", "drop-after");
        btn.classList.add(isBefore ? "drop-before" : "drop-after");
        e.dataTransfer.dropEffect = "move";
      });
      btn.addEventListener("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!btn.contains(e.relatedTarget)) {
          btn.classList.remove("drop-before", "drop-after");
        }
      });

      // 並び替え: drop で順序変更
      btn.addEventListener("drop", function (e) {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("drop-before", "drop-after");

        if (!dragSourceCatId || dragSourceCatId !== currentCategoryId) return;

        var srcId = e.dataTransfer.getData("text/plain");
        if (!srcId || srcId === se.id) return;

        var rect     = btn.getBoundingClientRect();
        var isBefore = viewMode === "list"
          ? e.clientY < rect.top + rect.height / 2
          : e.clientX < rect.left + rect.width / 2;

        var cfg = loadConfig();

        if (currentCategoryId === "cat_default") {
          // masterSEList の並び替え
          var srcItem = null;
          var newList = cfg.masterSEList.filter(function (s) {
            if (s.id === srcId) { srcItem = s; return false; }
            return true;
          });
          if (!srcItem) return;
          var destIdx = -1;
          for (var i = 0; i < newList.length; i++) {
            if (newList[i].id === se.id) { destIdx = i; break; }
          }
          if (destIdx === -1) return;
          newList.splice(isBefore ? destIdx : destIdx + 1, 0, srcItem);
          cfg.masterSEList = newList;
        } else {
          // カテゴリ seIds の並び替え
          var cat   = getCurrentCategory(cfg);
          var seIds = cat.seIds || [];
          var newIds = seIds.filter(function (id) { return id !== srcId; });
          var destIdxInIds = -1;
          for (var j = 0; j < newIds.length; j++) {
            if (newIds[j] === se.id) { destIdxInIds = j; break; }
          }
          if (destIdxInIds === -1) return;
          newIds.splice(isBefore ? destIdxInIds : destIdxInIds + 1, 0, srcId);
          cat.seIds = newIds;
        }

        saveConfig(cfg);
        renderSEButtons(getDisplaySEList(cfg));
        log("SEを並び替えました。", "info");
      });

      seGrid.appendChild(btn);
    });
  }

  /* =========================================================
     右クリック視聴（プレビュー）
  ========================================================= */
  function previewSE(se, btn) {
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
      var prevBtn = seGrid.querySelector(".previewing");
      if (prevBtn) { prevBtn.classList.remove("previewing"); }
      previewAudio = null;
    }

    if (btn.classList.contains("was-previewing")) {
      btn.classList.remove("was-previewing");
      log("視聴停止。", "info");
      return;
    }

    if (!fs.existsSync(se.fullPath)) {
      log("ファイルが見つかりません: " + se.fullPath, "error");
      return;
    }

    try {
      var filePath = se.fullPath.replace(/\\/g, "/");
      // Mac paths start with "/", Windows paths start with a drive letter.
      // file:// + /path = file:///path (correct); file:// + /C:/path = file:///C:/path (correct).
      var fileUrl  = filePath.charAt(0) === "/" ? "file://" + filePath : "file:///" + filePath;
      var audio    = new Audio(fileUrl);
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
     SEをカテゴリへ追加 / 移動
     すべてから → ADD（masterに残したままdestCatに参照追加）
     カテゴリから → MOVE（srcCatから削除してdestCatに追加）
  ========================================================= */
  function moveSEToCategory(seId, destCatId) {
    var cfg      = loadConfig();
    var srcCatId = dragSourceCatId || currentCategoryId;
    var destCat  = findCategoryById(cfg, destCatId);

    if (!destCat) { log("移動先カテゴリが見つかりません。", "error"); return; }

    destCat.seIds = destCat.seIds || [];

    if (destCat.seIds.indexOf(seId) !== -1) {
      var seName = (findSEById(cfg, seId) || {}).displayName || seId;
      log("「" + seName + "」は既にこのカテゴリに登録されています。", "warning");
      return;
    }

    // すべて以外のカテゴリからの移動 → 移動元から参照を削除
    if (srcCatId !== "cat_default") {
      var srcCat = findCategoryById(cfg, srcCatId);
      if (srcCat && srcCat.seIds) {
        srcCat.seIds = srcCat.seIds.filter(function (id) { return id !== seId; });
      }
    }

    destCat.seIds.push(seId);
    saveConfig(cfg);

    var se     = findSEById(cfg, seId);
    var label  = se ? se.displayName : seId;
    var action = srcCatId === "cat_default" ? "追加" : "移動";
    renderCategoryTabs(cfg);
    renderSEButtons(getDisplaySEList(cfg));
    log("「" + label + "」を「" + destCat.name + "」へ" + action + "しました。", "success");
  }

  /* =========================================================
     SE削除
     すべてビュー → masterSEList + 全カテゴリseIds から削除（完全削除）
     特定カテゴリ → そのカテゴリの seIds からのみ削除（参照解除）
  ========================================================= */
  function removeSE(seId, sourceCatId) {
    var cfg = loadConfig();

    if (sourceCatId === "cat_default") {
      cfg.masterSEList = cfg.masterSEList.filter(function (se) { return se.id !== seId; });
      cfg.categories.forEach(function (cat) {
        if (cat.seIds) {
          cat.seIds = cat.seIds.filter(function (id) { return id !== seId; });
        }
      });
      saveConfig(cfg);
      renderSEButtons(getDisplaySEList(cfg));
      log("SEをマスターから削除しました。", "info");
    } else {
      var cat = findCategoryById(cfg, sourceCatId);
      if (cat && cat.seIds) {
        cat.seIds = cat.seIds.filter(function (id) { return id !== seId; });
      }
      saveConfig(cfg);
      renderSEButtons(getDisplaySEList(cfg));
      log("SEをカテゴリから外しました（マスターには残っています）。", "info");
    }
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
      renderSEButtons(getDisplaySEList(cfg));
    });
  }

  /* =========================================================
     検索
  ========================================================= */
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      var cfg = loadConfig();
      renderSEButtons(getDisplaySEList(cfg));
    });
  }

  /* =========================================================
     登録エリアトグル
  ========================================================= */
  function updateDropToggleUI() {
    if (dropZoneOpen) {
      dropZoneWrap.classList.remove("hidden");
      dropToggleBtn.textContent = "▲ 登録エリアを閉じる";
    } else {
      dropZoneWrap.classList.add("hidden");
      dropToggleBtn.textContent = "▶ 登録エリアを開く";
    }
  }

  if (dropToggleBtn) {
    dropToggleBtn.addEventListener("click", function () {
      dropZoneOpen = !dropZoneOpen;
      updateDropToggleUI();
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
    var script   = 'placeSEOnTimeline("'
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
     ファイルドラッグ＆ドロップ
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

    var cfg    = loadConfig();
    var added  = 0, skipped = 0;
    var errors = [];

    for (var i = 0; i < files.length; i++) {
      var res = handleDroppedFile(files[i], cfg);
      if (res === "added")        { added++; }
      else if (res === "skipped") { skipped++; }
      else                        { errors.push(res); }
    }

    saveConfig(cfg);
    renderSEButtons(getDisplaySEList(cfg));

    var msg = "";
    if (added   > 0) { msg += added + "件追加。"; }
    if (skipped > 0) { msg += skipped + "件スキップ（既登録）。"; }
    if (errors.length > 0) { msg += "エラー: " + errors.join(" / "); }
    if (!msg) { msg = "追加できるファイルがありませんでした。"; }
    log(msg, errors.length > 0 ? "warning" : "success");
  });

  function handleDroppedFile(file, cfg) {
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

    // masterSEList に既にあるか確認（fullPath で照合）
    var existingInMaster = null;
    for (var i = 0; i < cfg.masterSEList.length; i++) {
      if (cfg.masterSEList[i].fullPath === destPath) {
        existingInMaster = cfg.masterSEList[i];
        break;
      }
    }

    var addedToMaster = false;

    if (!existingInMaster) {
      if (!fs.existsSync(destPath)) {
        try {
          fs.writeFileSync(destPath, fs.readFileSync(srcPath));
        } catch (e) {
          return "コピー失敗: " + file.name + " (" + e.message + ")";
        }
      }
      var newSE = {
        id:          generateId("se"),
        displayName: path.basename(file.name, ext),
        fileName:    file.name,
        fullPath:    destPath
      };
      cfg.masterSEList.push(newSE);
      existingInMaster = newSE;
      addedToMaster = true;
    }

    // 特定カテゴリ表示中 → そのカテゴリにも参照追加
    if (currentCategoryId !== "cat_default") {
      var cat = findCategoryById(cfg, currentCategoryId);
      if (cat) {
        cat.seIds = cat.seIds || [];
        if (cat.seIds.indexOf(existingInMaster.id) === -1) {
          cat.seIds.push(existingInMaster.id);
          return "added";
        } else {
          return "skipped";
        }
      }
    }

    return addedToMaster ? "added" : "skipped";
  }

  /* =========================================================
     初期化
  ========================================================= */
  function init() {
    try { ensureDir(AUDIO_DIR); } catch (e) {
      log("audioフォルダ作成失敗: " + e.message, "error");
    }

    var cfg = loadConfig();

    // 存在しないファイルを masterSEList から除去し、seIds も整理
    var before   = cfg.masterSEList.length;
    var validIds = {};
    cfg.masterSEList = cfg.masterSEList.filter(function (se) {
      if (fs.existsSync(se.fullPath)) {
        validIds[se.id] = true;
        return true;
      }
      return false;
    });
    var cleaned = cfg.masterSEList.length !== before;
    cfg.categories.forEach(function (cat) {
      if (cat.seIds) {
        var origLen = cat.seIds.length;
        cat.seIds = cat.seIds.filter(function (id) { return validIds[id]; });
        if (cat.seIds.length !== origLen) { cleaned = true; }
      }
    });
    if (cleaned) {
      saveConfig(cfg);
      log("存在しないSEをconfigから除去しました。", "warning");
    }

    trackBtns.forEach(function (b) {
      b.classList.remove("active");
      if (parseInt(b.dataset.track, 10) === selectedTrackIndex) {
        b.classList.add("active");
      }
    });

    currentCategoryId = cfg.categories[0].id;
    updateDropToggleUI();
    renderCategoryTabs(cfg);
    renderSEButtons(getDisplaySEList(cfg));

    setStatus("待機中", "idle");
    log("SEポン出しパネル 起動完了。", "info");
  }

  init();

})();
