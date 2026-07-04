import config from "./config.js";

export const log = [];

function getToken() {
  return localStorage.getItem("token");
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${config.API_BASE}${endpoint}`;
  const entry = { method: options.method || "GET", url, timestamp: new Date(), status: null, data: null, error: null };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();

    entry.status = res.status;
    if (!res.ok) {
      entry.error = data.error || "Request failed";
      log.push(entry);
      if (log.length > 50) log.shift();
      throw new Error(entry.error);
    }

    entry.data = data;
    log.push(entry);
    if (log.length > 50) log.shift();
    return data;
  } catch (err) {
    if (!entry.error) {
      entry.error = err.message;
      log.push(entry);
      if (log.length > 50) log.shift();
    }
    throw err;
  }
}

export function clearLog() {
  log.length = 0;
}

export const auth = {
  register: (username, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request("/auth/me"),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return request("/avatar", {
      method: "POST",
      body: formData,
      headers: {},
    });
  },
  uploadBanner: (file) => {
    const formData = new FormData();
    formData.append("banner", file);
    return request("/banner", {
      method: "POST",
      body: formData,
      headers: {},
    });
  },
  uploadBackground: (file) => {
    const formData = new FormData();
    formData.append("background", file);
    return request("/background", {
      method: "POST",
      body: formData,
      headers: {},
    });
  },
};

export const friends = {
  search: (username) => request(`/friends/search/${username}`),
  sendRequest: (userId) =>
    request(`/friends/request/${userId}`, { method: "POST" }),
  getRequests: () => request("/friends/requests"),
  acceptRequest: (id) =>
    request(`/friends/requests/${id}/accept`, { method: "POST" }),
  declineRequest: (id) =>
    request(`/friends/requests/${id}/decline`, { method: "POST" }),
  list: () => request("/friends"),
  getProfile: (id) => request(`/friends/${id}/profile`),
};

export const games = {
  list: () => request("/games"),
  getById: (id) => request(`/games/${id}`),
  create: (data) =>
    request("/games", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/games/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/games/${id}`, { method: "DELETE" }),
  stats: () => request("/games/stats"),
  addPlaytime: (id, minutes) =>
    request(`/games/${id}/playtime`, { method: "PUT", body: JSON.stringify({ minutes }) }),
  playtimeSummary: () => request("/games/playtime"),
  updateNotes: (id, notes) =>
    request(`/games/${id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),
  updateRating: (id, rating) =>
    request(`/games/${id}/rating`, { method: "PUT", body: JSON.stringify({ rating }) }),
  getSessions: (id) => request(`/games/${id}/sessions`),
  pinned: () => request("/games/pinned"),
  togglePin: (id) =>
    request(`/games/${id}/pin`, { method: "PUT" }),
  uploadCover: (file) => {
    const formData = new FormData();
    formData.append("cover", file);
    const token = localStorage.getItem("token");
    return request("/games/cover", {
      method: "POST",
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};

export const steam = {
  getLinkUrl: () => request("/steam/link-url"),
  getStatus: () => request("/steam/status"),
  sync: () => request("/steam/sync", { method: "POST" }),
  unlink: () => request("/steam/unlink", { method: "DELETE" }),
};

export const tags = {
  list: () => request("/tags"),
  create: (name) =>
    request("/tags", { method: "POST", body: JSON.stringify({ name }) }),
  delete: (id) => request(`/tags/${id}`, { method: "DELETE" }),
};

export const goals = {
  list: () => request("/goals"),
  check: () => request("/goals/check", { method: "POST" }),
};

export const admin = {
  auth: (password) =>
    request("/admin/auth", { method: "POST", body: JSON.stringify({ password }) }),
  listUsers: (token) =>
    request("/admin/users", { headers: { Authorization: `Bearer ${token}` } }),
  getUser: (id, token) =>
    request(`/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  updateUser: (id, data, token) =>
    request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data), headers: { Authorization: `Bearer ${token}` } }),
  deleteGame: (gameId, token) =>
    request(`/admin/games/${gameId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
};

export const decorations = {
  list: () => request("/decorations"),
  setMine: (decorationUrl) =>
    request("/settings/decoration", { method: "PUT", body: JSON.stringify({ decorationUrl }) }),
};

export const users = {
  getProfile: (id) => request(`/users/${id}/profile`),
};

export const chats = {
  list: () => request("/chats"),
  createOrGet: (userId) => request("/chats", { method: "POST", body: JSON.stringify({ userId }) }),
  getMessages: (convoId, after) => request(`/chats/${convoId}/messages${after ? `?after=${after}` : ""}`),
  sendMessage: (convoId, content) => request(`/chats/${convoId}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
};

export const notificationsApi = {
  list: () => request("/notifications"),
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PUT" }),
  markAllRead: () => request("/notifications/read-all", { method: "PUT" }),
};

export const settings = {
  get: () => request("/settings"),
  update: (data) =>
    request("/settings", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (currentPassword, newPassword) =>
    request("/settings/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateDisplayName: (displayName) =>
    request("/settings/display-name", {
      method: "PUT",
      body: JSON.stringify({ displayName }),
    }),
  updateBio: (bio) =>
    request("/settings/bio", { method: "PUT", body: JSON.stringify({ bio }) }),
  updateStatus: (status) =>
    request("/settings/status", { method: "PUT", body: JSON.stringify({ status }) }),
  updateAccentColor: (accentColor) =>
    request("/settings/accent-color", { method: "PUT", body: JSON.stringify({ accentColor }) }),
  updateBannerCrop: (bannerCrop) =>
    request("/settings/banner-crop", { method: "PUT", body: JSON.stringify({ bannerCrop }) }),
};
