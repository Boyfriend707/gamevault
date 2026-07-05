const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  serverUrl: "https://gamevault-gldm.onrender.com",
  steamAuth: (url) => ipcRenderer.invoke("steam-auth", url),
  checkUpdate: (serverUrl) => ipcRenderer.invoke("check-update", serverUrl),
  downloadUpdate: (serverUrl) => ipcRenderer.invoke("download-update", serverUrl),
  installUpdate: (installerPath) => ipcRenderer.invoke("install-update", installerPath),
  onDownloadProgress: (callback) => {
    ipcRenderer.on("update-download-progress", (_, progress) => callback(progress));
  },
  pickFile: () => ipcRenderer.invoke("pick-file"),
  launchGame: (exePath, gameId, gameTitle) => ipcRenderer.invoke("launch-game", exePath, gameId, gameTitle),
  launchSteamGame: (steamAppId) => ipcRenderer.invoke("launch-steam-game", steamAppId),
  startTrackingTitle: (gameId, gameTitle) => ipcRenderer.invoke("start-tracking-title", gameId, gameTitle),
  stopTracking: (gameId) => ipcRenderer.invoke("stop-tracking", gameId),
  onGameTimeElapsed: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on("game-time-elapsed", handler);
    return () => ipcRenderer.removeListener("game-time-elapsed", handler);
  },
  onTrackingStarted: (callback) => {
    const handler = (_, gameId) => callback(gameId);
    ipcRenderer.on("tracking-started", handler);
    return () => ipcRenderer.removeListener("tracking-started", handler);
  },
  storeGet: (key) => ipcRenderer.invoke("store-get", key),
  storeSet: (key, value) => ipcRenderer.invoke("store-set", key, value),
  scanForGames: (dirPath) => ipcRenderer.invoke("scan-for-games", dirPath),
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),
});
