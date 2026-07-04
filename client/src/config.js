const DEFAULT_SERVER = "http://localhost:3001";

function resolveServerUrl() {
  const stored = localStorage.getItem("server-url");
  if (stored) return stored;

  if (window.electronAPI?.serverUrl) {
    return window.electronAPI.serverUrl;
  }

  // In dev mode (Vite on port 5173), API is on port 3001
  if (window.location.port === "5173") {
    return DEFAULT_SERVER;
  }

  // Production: same origin serves both API and static files
  const origin = window.location.origin;
  if (origin && origin !== "null" && !origin.startsWith("file://")) {
    return origin;
  }
  return DEFAULT_SERVER;
}

let cachedUrl = resolveServerUrl() + "/api";

export function refreshConfig() {
  cachedUrl = resolveServerUrl() + "/api";
}

export function setServerUrl(url) {
  localStorage.setItem("server-url", url);
  refreshConfig();
}

export function resetServerUrl() {
  localStorage.removeItem("server-url");
  refreshConfig();
}

const config = {
  get API_BASE() { return cachedUrl; },
  get SERVER_URL() { return cachedUrl.replace("/api", ""); },
};

export default config;
