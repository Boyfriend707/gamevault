import { useState, useEffect } from "react";
import { Download, RefreshCw } from "lucide-react";
import config from "../config";

function UpdateDialog({ updateInfo, onClose }) {
  const [progress, setProgress] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [installerPath, setInstallerPath] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.electronAPI?.onDownloadProgress) {
      window.electronAPI.onDownloadProgress((p) => setProgress(p));
    }
  }, []);

  const handleDownload = async () => {
    if (!window.electronAPI) return;
    setDownloading(true);
    setError("");

    try {
      const serverUrl = config.API_BASE.replace("/api", "");
      const result = await window.electronAPI.downloadUpdate(serverUrl);

      if (result.success) {
        setDownloaded(true);
        setInstallerPath(result.installerPath);
      } else {
        setError(result.error || "Download failed");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (installerPath && window.electronAPI) {
      await window.electronAPI.installUpdate(installerPath);
    }
  };

  const handleLater = () => {
    localStorage.setItem("update-snoozed", updateInfo.version);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal update-modal">
        <h2>Update Available</h2>
        <p className="update-version">GameVault v{updateInfo.version}</p>
        {updateInfo.notes && <p className="update-notes">{updateInfo.notes}</p>}

        {error && <div className="error-message">{error}</div>}

        {!downloaded ? (
          <>
            {downloading && progress !== null && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={handleLater}>
                Not Now
              </button>
              <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <><RefreshCw size={16} className="spin" /> Downloading...</>
                ) : (
                  <><Download size={16} /> Download Update</>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={handleLater}>
              Later
            </button>
            <button className="btn btn-primary" onClick={handleInstall}>
              Install & Restart
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdateDialog;
