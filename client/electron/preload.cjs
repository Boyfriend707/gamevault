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
    const handler = (_, data) => callback(data);
    ipcRenderer.on("game-time-elapsed", handler);
    return () => ipcRenderer.removeListener("game-time-elapsed", handler);
  },
  onTrackingStarted: (callback) => {
    const handler = (_, gameId) => callback(gameId);
    ipcRenderer.on("tracking-started", handler);
    return () => ipcRenderer.removeListener("tracking-started", handler);
  },
  saveToken: (token) => ipcRenderer.invoke("save-token", token),
  loadToken: () => ipcRenderer.invoke("load-token"),
  clearToken: () => ipcRenderer.invoke("clear-token"),
  scanForGames: (dirPath) => ipcRenderer.invoke("scan-for-games", dirPath),
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),
});
