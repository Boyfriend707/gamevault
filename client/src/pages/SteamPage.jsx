import { useState, useEffect } from "react";
import { Gamepad2, RefreshCw, Link2, Unlink } from "lucide-react";
import { steam } from "../api";

function SteamPage() {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const data = await steam.getStatus();
      setStatus(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    try {
      const { url } = await steam.getLinkUrl();

      if (window.electronAPI?.isElectron) {
        const success = await window.electronAPI.steamAuth(url);
        if (success) {
          fetchStatus();
        }
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await steam.sync();
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Unlink your Steam account?")) return;
    try {
      await steam.unlink();
      setStatus({ linked: false });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="loading-spinner" />;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Steam</h1>
          <p className="page-subtitle">Steam account integration</p>
        </div>
      </div>

      <div className="card steam-card">
        {status?.linked ? (
          <>
            <div className="steam-profile">
              {status.avatarUrl && (
                <img src={status.avatarUrl} alt="" className="steam-avatar" />
              )}
              <div className="steam-info">
                <h3>{status.displayName || "Steam User"}</h3>
                <span className={`online-status ${status.onlineStatus > 0 ? "online" : "offline"}`}>
                  {status.onlineStatus > 0 ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            <div className="steam-actions">
              <button className="btn btn-primary" onClick={handleSync} disabled={syncing}>
                <RefreshCw size={16} className={syncing ? "spin" : ""} />
                {syncing ? "Syncing..." : "Sync Games"}
              </button>
              <button className="btn btn-secondary btn-danger" onClick={handleUnlink}>
                <Unlink size={16} />
                Unlink Steam
              </button>
            </div>
            {status.lastSynced && (
              <p className="steam-last-synced">
                Last synced: {new Date(status.lastSynced).toLocaleString()}
              </p>
            )}
          </>
        ) : (
          <div className="steam-empty">
            <Gamepad2 size={48} className="empty-icon" />
            <h2>No Steam account linked</h2>
            <p>Link your Steam account to automatically import your games and show your status</p>
            <button className="btn btn-primary" onClick={handleLink}>
              <Link2 size={16} />
              Link Steam Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SteamPage;
