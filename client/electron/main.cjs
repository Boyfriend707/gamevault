const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");
const { execFile, spawn } = require("child_process");

const isDev = !app.isPackaged;
function getMod(url) { return url.startsWith("https") ? https : http; }

let mainWindow;
let tray = null;
let updateInfo = null;
let presenceInterval;

function createTray() {
  const iconPath = path.join(__dirname, "../build/icon.ico");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    return;
  }
  tray = new Tray(icon);
  tray.setToolTip("GameVault");
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updatePresence() {
  if (!mainWindow) return;
  try {
    if (mainWindow.isDestroyed()) return;
    const entries = Array.from(trackedGames.entries());
    if (entries.length > 0) {
      const [gameId, track] = entries[0];
      const elapsed = Math.round((Date.now() - track.startTime) / 60000);
      const mins = Math.max(elapsed, 0);
      const label = track.gameTitle || `Game #${gameId}`;
      const status = `Playing ${label} (${mins}m session)`;
      try { if (tray) tray.setToolTip(`GameVault - ${status}`); } catch {}
      try { mainWindow.setTitle(`GameVault - ${status}`); } catch {}
    } else {
      try { if (tray) tray.setToolTip("GameVault"); } catch {}
      try { mainWindow.setTitle("GameVault"); } catch {}
    }
  } catch {}
}

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (e) => {
    if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    if (tray) { try { tray.destroy(); } catch {} tray = null; }
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);

function checkForUpdates(serverUrl) {
  return new Promise((resolve) => {
    const url = `${serverUrl}/api/update`;
    getMod(url).get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          updateInfo = JSON.parse(data);
          const current = app.getVersion().trim();
          const latest = (updateInfo.version || "").trim();
          if (latest && latest !== current) {
            resolve({ available: true, version: latest, notes: updateInfo.notes, downloadUrl: `${serverUrl}${updateInfo.downloadUrl}` });
          } else {
            resolve({ available: false });
          }
        } catch {
          resolve({ available: false });
        }
      });
    }).on("error", () => resolve({ available: false }));
  });
}

async function downloadUpdate(downloadUrl, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    getMod(downloadUrl).get(downloadUrl, (res) => {
      const total = parseInt(res.headers["content-length"] || "0");
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (mainWindow && total > 0) {
          mainWindow.webContents.send("update-download-progress", Math.round((downloaded / total) * 100));
        }
      });
      res.on("end", () => {
        file.end();
        resolve();
      });
    }).on("error", (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

ipcMain.handle("steam-auth", async (event, authUrl) => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 800,
      height: 700,
      title: "Steam Login",
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWindow.loadURL(authUrl);

    let resolved = false;

    function checkUrl(url) {
      if (resolved) return;
      if (url && url.includes("/api/steam/callback")) {
        resolved = true;
        setTimeout(() => authWindow.close(), 500);
        resolve(true);
      }
    }

    authWindow.webContents.on("did-navigate", (_, url) => checkUrl(url));
    authWindow.webContents.on("will-navigate", (_, url) => checkUrl(url));

    authWindow.on("closed", () => {
      if (!resolved) resolve(false);
    });
  });
});

ipcMain.handle("check-update", async (event, serverUrl) => {
  return await checkForUpdates(serverUrl);
});

ipcMain.handle("download-update", async (event, serverUrl) => {
  if (!updateInfo) return { success: false, error: "No update info" };

  const downloadUrl = `${serverUrl}${updateInfo.downloadUrl}`;
  const destPath = path.join(app.getPath("temp"), `GameVault-Setup-${updateInfo.version}.exe`);

  try {
    await downloadUpdate(downloadUrl, destPath);
    return { success: true, installerPath: destPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("open-devtools", () => {
  if (mainWindow) mainWindow.webContents.toggleDevTools();
});

ipcMain.handle("install-update", async (event, installerPath) => {
  try {
    execFile(installerPath, ["/S"], (err) => {
      if (err) console.error("Install failed:", err);
    });
    app.quit();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

const trackedGames = new Map();

function checkProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startTracking(gameId, exePath, gameTitle) {
  if (trackedGames.has(gameId)) return;
  trackedGames.set(gameId, { exePath, gameTitle: gameTitle || null, startTime: Date.now() });
  if (mainWindow) {
    mainWindow.webContents.send("tracking-started", gameId);
  }
  updatePresence();
}

function stopTracking(gameId) {
  const track = trackedGames.get(gameId);
  if (!track) return 0;
  const elapsed = Math.round((Date.now() - track.startTime) / 60000);
  trackedGames.delete(gameId);
  updatePresence();
  return Math.max(elapsed, 0);
}

function getTrackedGames() {
  const result = {};
  for (const [gameId, track] of trackedGames) {
    const elapsed = Math.round((Date.now() - track.startTime) / 60000);
    result[gameId] = { elapsed: Math.max(elapsed, 0) };
  }
  return result;
}

presenceInterval = setInterval(() => {
  if (!mainWindow) return;
  if (trackedGames.size > 0) {
    const toRemove = [];
    for (const [gameId, track] of trackedGames) {
      if (!checkProcessAlive(track.pid)) {
        toRemove.push(gameId);
      }
    }
    for (const gameId of toRemove) {
      const minutes = stopTracking(gameId);
      if (minutes > 0) {
        mainWindow.webContents.send("game-time-elapsed", { gameId, minutes });
      }
    }
  }
  updatePresence();
}, 10000);

ipcMain.handle("pick-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Executables", extensions: ["exe", "lnk", "bat", "cmd"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("launch-game", async (event, exePath, gameId, gameTitle) => {
  try {
    const child = spawn(exePath, [], { detached: true, stdio: "ignore" });
    child.unref();
    if (gameId && child.pid) {
      startTracking(gameId, exePath, gameTitle);
      const track = trackedGames.get(gameId);
      if (track) track.pid = child.pid;
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("launch-steam-game", async (event, steamAppId) => {
  try {
    await shell.openExternal(`steam://rungameid/${steamAppId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("start-tracking-title", async (event, gameId, gameTitle) => {
  startTracking(gameId, null, gameTitle);
  const track = trackedGames.get(gameId);
  if (track) track.pid = -1;
  return { success: true };
});

ipcMain.handle("stop-tracking", async (event, gameId) => {
  const minutes = stopTracking(gameId);
  return { success: true, minutes };
});

ipcMain.handle("scan-for-games", async (event, dirPath) => {
  try {
    const results = [];
    function scanDir(dir, depth) {
      if (depth > 2) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === ".exe" || ext === ".lnk") {
            const skip = ["unins", "setup", "install", "vc_redist", "dxwebsetup", "dotnet", "UEPrereq", "vcredist", "commonredist"];
            const name = path.basename(entry.name, ext);
            if (skip.some((s) => name.toLowerCase().includes(s))) continue;
            const gameName = path.basename(dir);
            results.push({ name: gameName, exePath: fullPath, platform: "PC" });
            break;
          }
        }
      }
    }
    scanDir(dirPath, 0);
    return { success: true, games: results };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("pick-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

const storePath = path.join(app.getPath("userData"), "store.json");
function readStore() {
  try { return JSON.parse(fs.readFileSync(storePath, "utf-8")); } catch { return {}; }
}
function writeStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data), "utf-8");
}
ipcMain.handle("store-get", async (_, key) => {
  return readStore()[key] ?? null;
});
ipcMain.handle("store-set", async (_, key, value) => {
  const store = readStore();
  if (value === null || value === undefined) {
    delete store[key];
  } else {
    store[key] = value;
  }
  writeStore(store);
});
ipcMain.handle("store-keys", async () => {
  return Object.keys(readStore());
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (presenceInterval) { clearInterval(presenceInterval); presenceInterval = null; }
    if (tray) { try { tray.destroy(); } catch {} tray = null; }
    app.exit(0);
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    createTray();
  }
});
