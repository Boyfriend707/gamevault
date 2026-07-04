import { useState, useEffect } from "react";
import { Moon, Sun, Camera, Sparkles, Check, Lock, X, Crown, Image } from "lucide-react";
import { settings, auth, decorations as decorationsApi } from "../api";
import config from "../config";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import BannerCropModal from "../components/BannerCropModal";

const BG_OPTIONS = [
  { id: null, label: "None", icon: X },
  { id: "aurora", label: "Aurora", icon: Moon },
  { id: "sunset-pulse", label: "Sunset Pulse", icon: Sun },
  { id: "midnight", label: "Midnight", icon: Moon },
  { id: "ocean-deep", label: "Ocean Deep", icon: Moon },
  { id: "matrix", label: "Matrix", icon: Moon },
  { id: "cyber-neon", label: "Cyber Neon", icon: Moon },
];

const ACCENT_COLORS = [
  "#6366f1", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#ec4899", "#a855f7", "#14b8a6", "#f97316", "#8b5cf6",
  "#e11d48", "#d946ef", "#0ea5e9", "#34d399", "#84cc16",
];

function Appearance({ user, onUserUpdate, onBgUpdate }) {
  const [theme, setTheme] = useState("light");
  const [unlockedThemes, setUnlockedThemes] = useState([]);
  const [decoList, setDecoList] = useState([]);
  const [showDecoPicker, setShowDecoPicker] = useState(false);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [statusText, setStatusText] = useState(user?.status || "");
  const [bannerCropFile, setBannerCropFile] = useState(null);
  const [userBg, setUserBg] = useState(() => localStorage.getItem("bg") || null);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  useEffect(() => {
    decorationsApi.list().then(setDecoList).catch(() => {});
    settings.get().then((s) => {
      const t = s.theme || "light";
      setTheme(t);
      localStorage.setItem("theme", t);
      document.documentElement.setAttribute("data-theme", t);
      setUnlockedThemes(s.unlockedThemes ? JSON.parse(s.unlockedThemes) : []);
      const bg = s.background;
      if (bg) {
        setUserBg(bg);
        localStorage.setItem("bg", bg);
        document.documentElement.setAttribute("data-bg", bg.startsWith("/uploads") ? "custom" : bg);
        if (onBgUpdate) onBgUpdate(bg);
      } else if (localStorage.getItem("bg")) {
        setUserBg(null);
        localStorage.removeItem("bg");
        document.documentElement.removeAttribute("data-bg");
        if (onBgUpdate) onBgUpdate("");
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setStatusText(user?.status || "");
  }, [user?.status]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await auth.uploadAvatar(file);
      const updated = { ...user, avatarUrl: result.avatarUrl };
      onUserUpdate(updated);
      showMessage("Avatar updated!");
    } catch (err) {
      showMessage("Failed to upload avatar", "error");
    }
  };

  const handleSetDecoration = async (decorationUrl) => {
    try {
      const updated = await decorationsApi.setMine(decorationUrl || null);
      onUserUpdate(updated);
      setShowDecoPicker(false);
      showMessage(decorationUrl ? "Decoration set!" : "Decoration removed");
    } catch (err) {
      showMessage("Failed to set decoration", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Appearance</h1>
          <p className="page-subtitle">Customize your look and theme</p>
        </div>
      </div>

      {message && <div className={`toast toast-${msgType}`}>{message}</div>}

      <div className="settings-sections">
        <div className="card">
          <div className="card-header">
            <h2>Theme</h2>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Theme</span>
                <span className="setting-desc">Choose your preferred look</span>
              </div>
            </div>
            <div className="theme-grid">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "midnight", label: "Midnight", icon: Moon },
                { id: "forest", label: "Forest", icon: Moon },
                { id: "nord", label: "Nord", icon: Moon, locked: user?.role !== "admin" && !unlockedThemes.includes("nord"), goal: "No Life" },
                { id: "sunset", label: "Sunset", icon: Sun, locked: user?.role !== "admin" && !unlockedThemes.includes("sunset"), goal: "Dedicated" },
                { id: "crimson", label: "Crimson", icon: Moon, locked: user?.role !== "admin" && !unlockedThemes.includes("crimson"), goal: "Completionist" },
                { id: "ocean", label: "Ocean", icon: Moon, locked: user?.role !== "admin" && !unlockedThemes.includes("ocean"), goal: "Chatterbox" },
                { id: "cyberpunk", label: "Cyberpunk", icon: Moon, locked: user?.role !== "admin" && !unlockedThemes.includes("cyberpunk"), goal: "Networker" },
                { id: "matrix", label: "Matrix", icon: Moon, locked: user?.role !== "admin" && !unlockedThemes.includes("matrix"), goal: "Century" },
                { id: "royal", label: "Royal", icon: Crown, locked: user?.role !== "vip" && user?.role !== "admin", goal: user?.role === "vip" || user?.role === "admin" ? "" : "VIP only" },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? "theme-active" : ""} ${t.locked ? "theme-locked" : ""}`}
                  onClick={() => {
                    if (t.locked) return;
                    settings.update({ theme: t.id });
                    setTheme(t.id);
                    localStorage.setItem("theme", t.id);
                    document.documentElement.setAttribute("data-theme", t.id);
                  }}
                >
                  <t.icon size={20} />
                  <span>{t.label}</span>
                  {t.locked && <span className="theme-lock-badge"><Lock size={12} /> {t.goal}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Page Background</h2>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Background</span>
                <span className="setting-desc">Animated gradient or custom image</span>
              </div>
            </div>
            <div className="theme-grid" style={{ marginTop: "0.5rem" }}>
              {BG_OPTIONS.map((bg) => (
                <button key={bg.id || "none"} className={`theme-option ${(!userBg || userBg === bg.id) ? "theme-active" : ""}`}
                  onClick={async () => {
                    try {
                      const s = await settings.update({ background: bg.id });
                      setUserBg(bg.id);
                      localStorage.setItem("bg", bg.id || "");
                      document.documentElement.setAttribute("data-bg", bg.id || "");
                      if (onBgUpdate) onBgUpdate(bg.id || "");
                      showMessage(bg.id ? `Background set to ${bg.label}` : "Background removed");
                    } catch (err) { showMessage("Failed to set background", "error"); }
                  }}>
                  <bg.icon size={20} />
                  <span>{bg.label}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <label className="btn btn-secondary btn-sm">
                <Image size={14} />
                {userBg?.startsWith("/uploads") ? "Change Image" : "Upload Image/GIF"}
                <input type="file" accept="image/*" hidden onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const result = await auth.uploadBackground(file);
                    await settings.update({ background: result.backgroundUrl });
                    setUserBg(result.backgroundUrl);
                    localStorage.setItem("bg", result.backgroundUrl);
                    document.documentElement.setAttribute("data-bg", "custom");
                    if (onBgUpdate) onBgUpdate(result.backgroundUrl);
                    showMessage("Background uploaded!");
                  } catch (err) { showMessage("Failed to upload background", "error"); }
                  e.target.value = "";
                }} />
              </label>
              {userBg?.startsWith("/uploads") && (
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  try {
                    await settings.update({ background: null });
                    setUserBg(null);
                    localStorage.setItem("bg", "");
                    document.documentElement.setAttribute("data-bg", "");
                    if (onBgUpdate) onBgUpdate("");
                    showMessage("Background removed");
                  } catch (err) { showMessage("Failed to remove", "error"); }
                }}>
                  <X size={14} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Status</h2>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Profile Status</span>
                <span className="setting-desc">A short line displayed under your name</span>
              </div>
            </div>
            <div className="search-row" style={{ marginTop: "0.5rem" }}>
              <input type="text" value={statusText} onChange={(e) => setStatusText(e.target.value)}
                placeholder="e.g. Playing Elden Ring" maxLength={60} className="search-input" />
              <button className="btn btn-primary" onClick={async () => {
                try {
                  const updated = await settings.updateStatus(statusText);
                  onUserUpdate(updated);
                  showMessage("Status updated!");
                } catch (err) {
                  showMessage("Failed to update status", "error");
                }
              }}>
                <Check size={16} /> Save
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Profile Accent</h2>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Accent Color</span>
                <span className="setting-desc">Shown on your profile page</span>
              </div>
            </div>
            <div className="accent-picker" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {ACCENT_COLORS.map((color) => (
                <button key={color} className="accent-swatch" style={{
                  width: 32, height: 32, borderRadius: "50%", border: user?.accentColor === color ? "2px solid var(--text)" : "2px solid transparent",
                  background: color, cursor: "pointer", outline: "none",
                }} onClick={async () => {
                  try {
                    const updated = await settings.updateAccentColor(color);
                    onUserUpdate(updated);
                    showMessage("Accent color updated!");
                  } catch (err) {
                    showMessage("Failed to update accent", "error");
                  }
                }} />
              ))}
              {user?.accentColor && !ACCENT_COLORS.includes(user.accentColor) && (
                <button className="accent-swatch" style={{
                  width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--text)",
                  background: user.accentColor, cursor: "pointer", outline: "none",
                }} onClick={async () => {
                  try {
                    const updated = await settings.updateAccentColor(null);
                    onUserUpdate(updated);
                    showMessage("Accent reset to default");
                  } catch (err) { showMessage("Failed to reset accent", "error"); }
                }} />
              )}
              <label className="accent-swatch" style={{ width: 32, height: 32, borderRadius: "50%", cursor: "pointer", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "var(--text-muted)", background: "var(--bg)" }}>
                <span>+</span>
                <input type="color" value={user?.accentColor || "#6366f1"} onChange={async (e) => {
                  try {
                    const updated = await settings.updateAccentColor(e.target.value);
                    onUserUpdate(updated);
                    showMessage("Accent color updated!");
                  } catch (err) { showMessage("Failed to update accent", "error"); }
                }} style={{ opacity: 0, position: "absolute", width: 0, height: 0 }} />
              </label>
              <button className="btn btn-sm btn-secondary" onClick={async () => {
                try {
                  const updated = await settings.updateAccentColor(null);
                  onUserUpdate(updated);
                  showMessage("Accent reset to default");
                } catch (err) { showMessage("Failed to reset accent", "error"); }
              }} style={{ fontSize: "0.75rem" }}>Reset</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Profile Banner</h2>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Banner Image</span>
                <span className="setting-desc">A large header image for your profile</span>
              </div>
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              {user?.bannerUrl && (
                <img src={`${config.SERVER_URL}${user.bannerUrl}`} alt="Banner preview"
                  style={{ width: 200, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
              )}
              <label className="btn btn-secondary">
                <Image size={16} />
                {user?.bannerUrl ? "Change Banner" : "Upload Banner"}
                <input type="file" accept="image/*" hidden onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setBannerCropFile(reader.result);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }} />
              </label>
              {user?.bannerUrl && (
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  try {
                    const res = await fetch(`${config.API_BASE}/banner`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ bannerUrl: null }),
                    });
                    const data = await res.json();
                    if (data.bannerUrl === null || data.bannerUrl === undefined) {
                      onUserUpdate({ ...user, bannerUrl: null });
                      showMessage("Banner removed");
                    }
                  } catch (err) { showMessage("Failed to remove banner", "error"); }
                }}>
                  <X size={14} /> Remove
                </button>
              )}
              <span className="setting-desc">Max 4MB, PNG/JPG/GIF/WebP</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Avatar</h2>
          </div>
          <div className="card-body">
            <div className="avatar-upload-row">
              <div className="avatar-preview">
                <AvatarWithDecoration user={user} size={96} />
              </div>
              <div className="avatar-upload-info">
                <label className="btn btn-secondary">
                  <Camera size={16} />
                  Choose Image
                  <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                </label>
                <button className="btn btn-secondary" onClick={() => setShowDecoPicker(true)}>
                  <Sparkles size={16} />
                  Decoration
                </button>
                <span className="setting-desc">Max 2MB, PNG/JPG/GIF/WebP</span>
              </div>
            </div>
          </div>
        </div>

        {bannerCropFile && (
          <BannerCropModal imageSrc={bannerCropFile} isGif={bannerCropFile.startsWith("data:image/gif")}
            onClose={() => setBannerCropFile(null)}
            onSave={async (result) => {
              try {
                if (result.type === "gif") {
                  const file = await fetch(bannerCropFile).then((r) => r.blob());
                  const upload = await auth.uploadBanner(new File([file], "banner.gif", { type: "image/gif" }));
                  await settings.updateBannerCrop(result.crop);
                  onUserUpdate({ ...user, bannerUrl: upload.bannerUrl, bannerCrop: result.crop });
                } else {
                  const upload = await auth.uploadBanner(new File([result.blob], "banner.webp", { type: "image/webp" }));
                  await settings.updateBannerCrop(null);
                  onUserUpdate({ ...user, bannerUrl: upload.bannerUrl, bannerCrop: null });
                }
                setBannerCropFile(null);
                showMessage("Banner uploaded!");
              } catch (err) {
                showMessage("Failed to upload banner", "error");
              }
            }} />
        )}

        {showDecoPicker && (
          <div className="modal-overlay" onClick={() => setShowDecoPicker(false)}>
            <div className="modal deco-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <h2>Choose Decoration</h2>
                <button className="btn-icon" onClick={() => setShowDecoPicker(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="deco-picker-grid">
                <div className={`deco-option ${!user.decorationUrl ? "deco-active" : ""}`}
                  onClick={() => handleSetDecoration(null)}>
                  <div className="deco-preview">None</div>
                </div>
                {decoList.map((d) => (
                  <div key={d.id} className={`deco-option ${user.decorationUrl === d.fileUrl ? "deco-active" : ""}`}
                    onClick={() => handleSetDecoration(d.fileUrl)}>
                    <div className="deco-preview">
                      <AvatarWithDecoration user={{ ...user, decorationUrl: d.fileUrl }} size={64} />
                    </div>
                    <span className="deco-name">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Appearance;
