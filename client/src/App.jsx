import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { auth, dailyChallenges } from "./api";
import config, { resolveAssetUrl } from "./config";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Collection from "./pages/Collection";
import SteamPage from "./pages/SteamPage";
import Settings from "./pages/Settings";
import Appearance from "./pages/Appearance";
import Profile from "./pages/Profile";
import GameDetail from "./pages/GameDetail";
import Challenges from "./pages/Challenges";
import Chat from "./pages/Chat";
import UpdateDialog from "./components/UpdateDialog";
import { ToastProvider } from "./components/Toast";
import useKeyboardShortcuts, { useShortcut } from "./hooks/useKeyboardShortcuts";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [bgValue, setBgValue] = useState(() => localStorage.getItem("bg") || "");
  const [bgVideo, setBgVideo] = useState(() => localStorage.getItem("bgVideo") || "");
  const [bgType, setBgType] = useState(() => localStorage.getItem("bgType") || "gradient");
  const [shortcutsEnabled, setShortcutsEnabled] = useState(() => localStorage.getItem("shortcuts") !== "false");
  const navigate = useNavigate();

  useKeyboardShortcuts(shortcutsEnabled);
  useShortcut("search", () => { const s = document.querySelector(".search-input"); if (s) s.focus(); });
  useShortcut("close", () => { const m = document.querySelector(".modal-overlay"); if (m) m.click(); });

  useEffect(() => {
    (async () => {
      const store = window.electronAPI?.storeGet;
      const theme = localStorage.getItem("theme") || (store ? await store("theme") : null) || "light";
      document.documentElement.setAttribute("data-theme", theme);
      const bg = localStorage.getItem("bg") || (store ? await store("bg") : null);
      if (bg) {
        document.documentElement.setAttribute("data-bg", bg.startsWith("/uploads") ? "custom" : bg);
        setBgValue(bg);
      }

      let token = localStorage.getItem("token") || (store ? await store("token") : null);
      if (token) localStorage.setItem("token", token);
          if (token) {
        for (let i = 0; i < 60; i++) {
          try {
            const u = await auth.me();
            setUser(u);
            dailyChallenges.check().catch(() => {});
            const fontSize = localStorage.getItem("fontSize");
            if (fontSize) document.documentElement.style.fontSize = fontSize;
            const density = localStorage.getItem("density");
            if (density) document.body.classList.add(`density-${density}`);
            const reducedMotion = localStorage.getItem("reducedMotion") === "true";
            if (reducedMotion) document.documentElement.style.scrollBehavior = "auto";
            setLoading(false);
            return;
          } catch (err) {
            if (err.status === 401) {
              localStorage.removeItem("token");
              if (window.electronAPI?.storeSet) await window.electronAPI.storeSet("token", null);
              setLoading(false);
              return;
            }
            await new Promise((r) => setTimeout(r, Math.min(2000 * (i + 1), 15000)));
          }
        }
        setLoading(false);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loading && user && window.electronAPI?.isElectron) {
      const snoozed = localStorage.getItem("update-snoozed");
      window.electronAPI.checkUpdate(config.SERVER_URL).then((result) => {
        if (result.available && result.version !== snoozed && result.version !== __APP_VERSION__) {
          setUpdateInfo(result);
        }
      }).catch(() => {});
    }
  }, [loading, user]);

  const handleLogin = async (token, userData) => {
    localStorage.setItem("token", token);
    if (window.electronAPI?.storeSet) await window.electronAPI.storeSet("token", token);
    setUser(userData);
    navigate("/");
  };

  const handleLogout = async () => {
    localStorage.removeItem("token");
    if (window.electronAPI?.storeSet) await window.electronAPI.storeSet("token", null);
    setUser(null);
    navigate("/login");
  };

  const handleCheckUpdate = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.checkUpdate(config.SERVER_URL).catch(() => null);
    if (result?.available) {
      setUpdateInfo(result);
    } else {
      alert("You have the latest version!");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const isCustomBg = bgValue && (bgValue.startsWith("/uploads") || bgValue.startsWith("http"));
  const isVideoBg = bgType === "video" && bgVideo;
  const bgClass = !isVideoBg && bgValue ? (isCustomBg ? "bg-custom" : `bg-${bgValue}`) : "";

  return (
    <ToastProvider>
    <div className="app">
      {isVideoBg ? (
        <div className="bg-video">
          <video src={bgVideo} autoPlay loop muted playsInline />
        </div>
      ) : bgClass ? (
        <div className={`page-bg ${bgClass}`} style={isCustomBg ? { backgroundImage: `url(${resolveAssetUrl(bgValue)})` } : {}} />
      ) : null}
      <Navbar user={user} onLogout={handleLogout} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/steam" element={<SteamPage />} />
          <Route path="/settings" element={<Settings user={user} onCheckUpdate={handleCheckUpdate} onUserUpdate={setUser} />} />
          <Route path="/appearance" element={<Appearance user={user} onUserUpdate={setUser} onBgUpdate={setBgValue} />} />
          <Route path="/profile/:id" element={<Profile user={user} />} />
          <Route path="/game/:id" element={<GameDetail />} />
          <Route path="/profile" element={<Navigate to={`/profile/${user.id}`} />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/chat" element={<Chat user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      {updateInfo && (
        <UpdateDialog
          updateInfo={updateInfo}
          onClose={() => setUpdateInfo(null)}
        />
      )}
    </div>
    </ToastProvider>
  );
}

export default App;
