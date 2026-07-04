import { useState } from "react";
import { Bug, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { log, clearLog } from "../api";
import { setServerUrl, resetServerUrl } from "../config";

function DebugPanel() {
  const [serverUrl, setUrl] = useState(localStorage.getItem("server-url") || "");
  const [expanded, setExpanded] = useState(null);

  const handleSaveUrl = () => {
    if (serverUrl.trim()) {
      setServerUrl(serverUrl.trim());
      window.location.reload();
    }
  };

  const handleResetUrl = () => {
    resetServerUrl();
    setUrl("");
    window.location.reload();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2><Bug size={16} /> Developer Mode</h2>
        <span className="badge">DEV</span>
      </div>
      <div className="card-body">
        <div className="setting-section">
          <h3>Server URL</h3>
          <div className="search-row">
            <input
              type="text"
              className="search-input"
              value={serverUrl}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:3001"
            />
            <button className="btn btn-sm btn-primary" onClick={handleSaveUrl}>
              Apply
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleResetUrl}>
              Reset
            </button>
          </div>
        </div>

        <div className="setting-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>API Log ({log.length})</h3>
            <button className="btn btn-sm btn-secondary" onClick={clearLog}>
              <Trash2 size={12} /> Clear
            </button>
          </div>
          <div className="debug-log">
            {log.length === 0 ? (
              <p className="empty-text">No API calls yet</p>
            ) : (
              [...log].reverse().map((entry, i) => (
                <div
                  key={i}
                  className={`debug-entry ${entry.error ? "debug-error" : ""}`}
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="debug-entry-header">
                    {expanded === i ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <span className="debug-method">{entry.method}</span>
                    <span className="debug-path">{new URL(entry.url).pathname}</span>
                    <span className={`debug-status ${entry.error ? "status-error" : "status-ok"}`}>
                      {entry.error ? "ERR" : entry.status}
                    </span>
                    <span className="debug-time">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {expanded === i && (
                    <div className="debug-entry-detail">
                      <pre>{JSON.stringify(entry.data || entry.error, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
