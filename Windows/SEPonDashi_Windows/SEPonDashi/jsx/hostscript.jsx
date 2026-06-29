// hostscript.jsx v8

/* global app */

function placeSEOnTimeline(filePath, audioTrackIndex) {
  try {

    if (!app.project) {
      return "ERR:project not open";
    }

    var seq = app.project.activeSequence;
    if (!seq) {
      return "ERR:no active sequence";
    }

    var audioTracks = seq.audioTracks;
    if (!audioTracks || audioTracks.numTracks === 0) {
      return "ERR:no audio tracks";
    }
    if (audioTrackIndex >= audioTracks.numTracks) {
      return "ERR:A" + (audioTrackIndex + 1) + " not exist";
    }

    var ctiTime = seq.getPlayerPosition();

    // まずパスで検索、なければファイル名で検索（プロマネ流用時の重複防止）
    var projectItem = findProjectItemByPath(app.project.rootItem, filePath);

    if (!projectItem) {
      var fileName = filePath.replace(/.*[\/]/, "");
      projectItem = findProjectItemByName(app.project.rootItem, fileName);
    }

    if (!projectItem) {
      var imported = app.project.importFiles(
        [filePath], true, app.project.rootItem, false
      );
      if (!imported) {
        return "ERR:importFiles failed. path=" + filePath;
      }
      projectItem = findProjectItemByPath(app.project.rootItem, filePath);
      if (!projectItem) {
        return "ERR:item not found after import. path=" + filePath;
      }
    }

    var i;
    var videoTracks = seq.videoTracks;
    var vCount      = videoTracks ? videoTracks.numTracks : 0;
    var vLocks      = [];
    for (i = 0; i < vCount; i++) {
      try {
        vLocks[i] = videoTracks[i].isLocked();
        videoTracks[i].setLocked(true);
      } catch(ev) { vLocks[i] = false; }
    }

    var aLocks = [];
    for (i = 0; i < audioTracks.numTracks; i++) {
      try {
        aLocks[i] = audioTracks[i].isLocked();
        audioTracks[i].setLocked(i !== audioTrackIndex);
      } catch(ea) { aLocks[i] = false; }
    }

    var placed = false;
    var errMsg = "";

    try {
      var track  = audioTracks[audioTrackIndex];
      var before = -1;
      try { before = track.clips.numItems; } catch(e1) {}

      seq.overwriteClip(projectItem, ctiTime, 0, audioTrackIndex);

      var after = -1;
      try { after = track.clips.numItems; } catch(e2) {}

      if ((before >= 0 && after > before) || before < 0) {
        placed = true;
      }
    } catch(eow) {
      errMsg += "ow:" + eow.toString();
    }

    if (!placed) {
      try {
        var track2  = audioTracks[audioTrackIndex];
        var before2 = -1;
        try { before2 = track2.clips.numItems; } catch(e3) {}

        seq.insertClip(projectItem, ctiTime, 0, audioTrackIndex);

        var after2 = -1;
        try { after2 = track2.clips.numItems; } catch(e4) {}

        if ((before2 >= 0 && after2 > before2) || before2 < 0) {
          placed = true;
        }
      } catch(eic) {
        errMsg += " ic:" + eic.toString();
      }
    }

    if (!placed) {
      try {
        app.sourceMonitor.openProjectItem(projectItem, 0);
        app.sourceMonitor.overwriteAtTime(ctiTime);
        placed = true;
      } catch(esm) {
        errMsg += " sm:" + esm.toString();
      }
    }

    for (i = 0; i < vCount; i++) {
      try { videoTracks[i].setLocked(vLocks[i]); } catch(ev2) {}
    }
    for (i = 0; i < audioTracks.numTracks; i++) {
      try { audioTracks[i].setLocked(aLocks[i]); } catch(ea2) {}
    }

    if (!placed) {
      return "ERR:[" + errMsg + "]";
    }

    return "OK:A" + (audioTrackIndex + 1);

  } catch(e) {
    return "ERR:" + e.toString();
  }
}

function findProjectItemByName(parentItem, targetName) {
  if (!parentItem) { return null; }

  if (parentItem.type !== 2 && parentItem.type !== 4) {
    try {
      if (parentItem.name === targetName) {
        return parentItem;
      }
    } catch(ex) {}
  }

  if (parentItem.children && parentItem.children.numItems > 0) {
    for (var i = 0; i < parentItem.children.numItems; i++) {
      var found = findProjectItemByName(parentItem.children[i], targetName);
      if (found) { return found; }
    }
  }
  return null;
}

function findProjectItemByPath(parentItem, targetPath) {
  if (!parentItem) { return null; }

  if (parentItem.type !== 2 && parentItem.type !== 4) {
    var itemPath = "";
    try {
      itemPath = parentItem.getMediaPath().replace(/\\/g, "/");
    } catch(ex) { itemPath = ""; }

    if (itemPath !== "" &&
        itemPath.toLowerCase() === targetPath.replace(/\\/g, "/").toLowerCase()) {
      return parentItem;
    }
  }

  if (parentItem.children && parentItem.children.numItems > 0) {
    for (var i = 0; i < parentItem.children.numItems; i++) {
      var found = findProjectItemByPath(parentItem.children[i], targetPath);
      if (found) { return found; }
    }
  }
  return null;
}
