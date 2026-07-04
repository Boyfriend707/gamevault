import { useState, useEffect } from "react";
import { Keyboard } from "lucide-react";
import { settings } from "../api";
import { shortcutBus } from "../hooks/useKeyboardShortcuts";
import { DEFAULT_BINDINGS, LABELS } from "../hooks/useKeyboardShortcuts";

function ShortcutsSettings() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settings.get().then((s) => {
      let sc = { enabled: true, bindings: {} };
      try { sc = JSON.parse(s.shortcuts || "{}"); } catch {}
      setEnabled(sc.enabled !== false);
      shortcutBus.setEnabled(sc.enabled !== false);
      localStorage.setItem("shortcuts", sc.enabled !== false ? "true" : "false");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = async () => {
    const newVal = !enabled;
    try {
      const s = await settings.update({ shortcuts: JSON.stringify({ enabled: newVal, bindings: {} }) });
      const sc = JSON.parse(s.shortcuts || "{}");
      setEnabled(sc.enabled !== false);
      shortcutBus.setEnabled(sc.enabled !== false);
      localStorage.setItem("shortcuts", sc.enabled !== false ? "true" : "false");
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;

  const keys = Object.entries(DEFAULT_BINDINGS);
  const mergedBindings = { ...DEFAULT_BINDINGS };

  return (
    <div className="card">
      <div className="card-header">
        <h2><Keyboard size={18} /> Keyboard Shortcuts</h2>
      </div>
      <div className="card-body">
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Enable Shortcuts</span>
            <span className="setting-desc">Global keyboard shortcuts for quick actions</span>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={enabled} onChange={toggle} />
            <span className="toggle-slider" />
          </label>
        </div>

        {enabled && (
          <div className="shortcuts-list">
            {keys.map(([key, action]) => (
              <div key={action} className="shortcut-row">
                <span className="shortcut-action">{LABELS[action] || action}</span>
                <kbd className="shortcut-key">{key === " " ? "Space" : key}</kbd>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShortcutsSettings;
