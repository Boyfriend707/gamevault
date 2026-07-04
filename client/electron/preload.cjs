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
  launchGame: (exePath, gameId) => ipcRenderer.invoke("launch-game", exePath, gameId),
  launchSteamGame: (steamAppId) => ipcRenderer.invoke("launch-steam-game", steamAppId),
  stopTracking: (gameId) => ipcRenderer.invoke("stop-tracking", gameId),
  onGameTimeElapsed: (callback) => {
    ipcRenderer.on("game-time-elapsed", (_, data) => callback(data));
  },
  onTrackingStarted: (callback) => {
    ipcRenderer.on("tracking-started", (_, gameId) => callback(gameId));
  },
  scanForGames: (dirPath) => ipcRenderer.invoke("scan-for-games", dirPath),
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),
});
