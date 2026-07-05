import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit3, Trash2, Gamepad2, Play, Square, FolderOpen, Clock, Tag, FileText, Pin, X, Shuffle, LayoutGrid, List, FileDown, FileUp } from "lucide-react";
import { games, tags as tagsApi } from "../api";
import config, { resolveCoverUrl } from "../config";

const PLATFORMS = ["PC", "PlayStation", "Xbox", "Nintendo", "Mobile", "Other"];
const STATUSES = ["not-playing", "playing", "completed", "dropped"];

function Collection() {
  const [gameList, setGameList] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [tagFilter, setTagFilter] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [selectedScan, setSelectedScan] = useState({});
  const [newTagName, setNewTagName] = useState("");
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(null);
  const [form, setForm] = useState({ name: "", platform: "PC", notes: "", status: "not-playing", localPath: "", steamAppId: "", coverUrl: "", tagIds: [] });
  const [notesTarget, setNotesTarget] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("collection-view") || "grid");
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("collection-sort") || "name");
  const [importResult, setImportResult] = useState(null);
  const navigate = useNavigate();
  const importRef = useRef(null);

  const handleExport = async () => {
    try {
      const res = await fetch(`${config.apiUrl}/games/export-csv`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gamevault-collection.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await games.importCsv(file);
      setImportResult(res);
    } catch (err) { console.error(err); }
    if (importRef.current) importRef.current.value = "";
  };

  useEffect(() => {
    fetchGames();
    tagsApi.list().then(setAllTags).catch(console.error);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubTime = window.electronAPI.onGameTimeElapsed(({ gameId, minutes }) => {
      if (minutes > 0) {
        games.addPlaytime(gameId, minutes).then(fetchGames).catch(console.error);
      }
      setTracking((prev) => prev === gameId ? null : prev);
    });
    const unsubTrack = window.electronAPI.onTrackingStarted((gameId) => {
      setTracking(gameId);
    });
    return () => { unsubTime(); unsubTrack(); };
  }, []);

  const fetchGames = async () => {
    try {
      const data = await games.list();
      setGameList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRandomGame = async () => {
    try {
      const result = await games.random();
      if (result) navigate(`/game/${result.id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = gameList
    .filter((g) => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "All" || g.status === filter;
      const matchTag = !tagFilter || (g.tags || []).some((gt) => gt.tag.id === tagFilter);
      return matchSearch && matchFilter && matchTag;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "playtime": return b.playtime - a.playtime;
        case "rating": return (b.rating || -1) - (a.rating || -1);
        case "recent": return new Date(b.createdAt) - new Date(a.createdAt);
        default: return 0;
      }
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await games.update(editing.id, form);
      } else {
        await games.create(form);
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: "", platform: "PC", notes: "", status: "not-playing", localPath: "", steamAppId: "", coverUrl: "", tagIds: [] });
      fetchGames();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (game) => {
    setEditing(game);
    setForm({
      name: game.name,
      platform: game.platform,
      notes: game.notes || "",
      status: game.status,
      localPath: game.localPath || "",
      steamAppId: game.steamAppId || "",
      coverUrl: game.coverUrl || "",
      tagIds: (game.tags || []).map((gt) => gt.tag.id),
    });
    setShowModal(true);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await tagsApi.create(newTagName.trim());
      setAllTags([...allTags, tag]);
      setNewTagName("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTag = async (tagId) => {
    try {
      await tagsApi.delete(tagId);
      setAllTags(allTags.filter((t) => t.id !== tagId));
      if (tagFilter === tagId) setTagFilter(null);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTag = (tagId) => {
    setForm((prev) => {
      const ids = prev.tagIds.includes(tagId)
        ? prev.tagIds.filter((id) => id !== tagId)
        : [...prev.tagIds, tagId];
      return { ...prev, tagIds: ids };
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this game?")) return;
    try {
      await games.delete(id);
      fetchGames();
    } catch (err) {
      console.error(err);
    }
  };

  const handleScan = async (dirPath) => {
    if (!window.electronAPI?.scanForGames) return;
    setScanning(true);
    try {
      let path = dirPath;
      if (!path) {
        path = await window.electronAPI.pickDirectory();
        if (!path) { setScanning(false); return; }
      }
      const result = await window.electronAPI.scanForGames(path);
      if (result.success) {
        setScanResults(result.games);
        setSelectedScan({});
        setShowScanModal(true);
      } else {
        alert("Scan failed: " + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleImportScanned = async () => {
    const toAdd = scanResults.filter((g) => selectedScan[g.exePath]);
    if (toAdd.length === 0) return;
    try {
      for (const game of toAdd) {
        await games.create({
          name: game.name,
          platform: game.platform,
          localPath: game.exePath,
        });
      }
      setShowScanModal(false);
      setScanResults([]);
      fetchGames();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickFile = async () => {
    if (!window.electronAPI?.pickFile) return;
    const filePath = await window.electronAPI.pickFile();
    if (filePath) setForm({ ...form, localPath: filePath });
  };

  const handleLaunch = async (game) => {
    if (tracking === game.id) {
      if (!window.electronAPI) return;
      const res = await window.electronAPI.stopTracking(game.id);
      if (res.minutes > 0) {
        await games.addPlaytime(game.id, res.minutes);
        fetchGames();
      }
      setTracking(null);
      return;
    }
    if (game.steamAppId && window.electronAPI?.launchSteamGame) {
      const result = await window.electronAPI.launchSteamGame(game.steamAppId);
      if (!result.success) alert("Failed to launch: " + result.error);
      else if (window.electronAPI?.startTrackingTitle) {
        await window.electronAPI.startTrackingTitle(game.id, game.title);
      }
    } else if (game.localPath && window.electronAPI?.launchGame) {
      const result = await window.electronAPI.launchGame(game.localPath, game.id, game.title);
      if (!result.success) alert("Failed to launch: " + result.error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Collection</h1>
          <p className="page-subtitle">Your game collection</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ name: "", platform: "PC", notes: "", status: "not-playing", localPath: "", tagIds: [] }); setShowModal(true); }}>
          <Plus size={18} />
          Add Game
        </button>
        <button className="btn btn-secondary" onClick={handleExport}>
          <FileDown size={16} />
          Export CSV
        </button>
        <button className="btn btn-secondary" onClick={() => importRef.current?.click()}>
          <FileUp size={16} />
          Import CSV
        </button>
        <input type="file" ref={importRef} style={{ display: "none" }} accept=".csv" onChange={handleImport} />
        {window.electronAPI?.scanForGames && (
          <button className="btn btn-secondary" onClick={() => handleScan()} disabled={scanning}>
            {scanning ? "Scanning..." : "Scan for Games"}
          </button>
        )}
      </div>

      {importResult && (
        <div className="import-result">
          <span>Imported: {importResult.imported} | Skipped: {importResult.skipped} | Errors: {importResult.errors.length}</span>
          <button className="btn-icon" onClick={() => { setImportResult(null); fetchGames(); }}><X size={14} /></button>
        </div>
      )}

      <div className="search-filter-row">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search games..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="filter-select">
          <option value="All">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select value={tagFilter || ""} onChange={(e) => setTagFilter(e.target.value ? parseInt(e.target.value) : null)} className="filter-select">
            <option value="">All Tags</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => setShowTagManager(!showTagManager)} title="Manage tags">
          <Tag size={16} />
        </button>
        <button className="btn btn-secondary btn-sm" onClick={handleRandomGame} title="Random game">
          <Shuffle size={16} />
        </button>
        <div className="view-toggle">
          <button className={`btn-icon ${viewMode === "grid" ? "btn-icon-active" : ""}`} onClick={() => { setViewMode("grid"); localStorage.setItem("collection-view", "grid"); }} title="Grid view">
            <LayoutGrid size={16} />
          </button>
          <button className={`btn-icon ${viewMode === "list" ? "btn-icon-active" : ""}`} onClick={() => { setViewMode("list"); localStorage.setItem("collection-view", "list"); }} title="List view">
            <List size={16} />
          </button>
        </div>
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); localStorage.setItem("collection-sort", e.target.value); }} className="filter-select" style={{ width: "auto" }}>
          <option value="name">Name</option>
          <option value="playtime">Playtime</option>
          <option value="rating">Rating</option>
          <option value="recent">Recent</option>
        </select>
      </div>

      {showTagManager && (
        <div className="tag-manager">
          <div className="tag-manager-input-row">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
            />
            <button className="btn btn-sm btn-primary" onClick={handleCreateTag}>Add Tag</button>
          </div>
          <div className="tag-manager-list">
            {allTags.map((t) => (
              <span key={t.id} className="tag-chip">
                {t.name}
                <button className="tag-chip-remove" onClick={() => handleDeleteTag(t.id)}>
                  <X size={12} />
                </button>
              </span>
            ))}
            {allTags.length === 0 && <p className="empty-text">No tags yet</p>}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner" />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Gamepad2 size={48} className="empty-icon" />
          <h2>No games yet</h2>
          <p>Add your first game to start building your collection</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Add Your First Game
          </button>
        </div>
      ) : viewMode === "list" ? (
        <div className="game-list-table">
          <div className="game-list-header">
            <span className="game-list-th game-list-th-cover"></span>
            <span className="game-list-th">Name</span>
            <span className="game-list-th">Platform</span>
            <span className="game-list-th">Status</span>
            <span className="game-list-th">Playtime</span>
            <span className="game-list-th"></span>
          </div>
          {filtered.map((game) => {
            const isTracking = tracking === game.id;
            const hours = Math.floor(game.playtime / 60);
            const mins = game.playtime % 60;
            return (
              <div key={game.id} className="game-list-row" onClick={() => navigate(`/game/${game.id}`)}>
                <div className="game-list-cell game-list-cell-cover">
                  {game.coverUrl ? <img className="game-list-thumb" src={resolveCoverUrl(game.coverUrl)} alt="" onError={(e) => { e.target.style.display = "none"; }} /> : <Gamepad2 size={24} />}
                </div>
                <div className="game-list-cell"><span className="game-list-name">{game.name}</span></div>
                <div className="game-list-cell"><span className="game-list-platform">{game.platform}</span></div>
                <div className="game-list-cell"><span className={`game-status-badge status-${game.status}`}>{game.status}</span></div>
                <div className="game-list-cell"><span className="game-list-playtime">{hours > 0 ? `${hours}h ` : ""}{mins}m</span></div>
                <div className="game-list-cell game-list-cell-actions" onClick={(e) => e.stopPropagation()}>
                  {(game.localPath || game.steamAppId) && (
                    <button className={`btn-icon ${isTracking ? "btn-icon-stop" : "btn-icon-play"}`} onClick={() => handleLaunch(game)}>
                      {isTracking ? <Square size={14} /> : <Play size={14} />}
                    </button>
                  )}
                  <button className={`btn-icon ${game.pinned ? "btn-icon-active" : ""}`} onClick={async () => {
                    try { await games.togglePin(game.id); fetchGames(); } catch (err) { alert(err.message); }
                  }}><Pin size={14} /></button>
                  <button className="btn-icon" onClick={() => { setNotesTarget(game); setNotesText(game.notes || ""); }}><FileText size={14} /></button>
                  <button className="btn-icon" onClick={() => handleEdit(game)}><Edit3 size={14} /></button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(game.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="game-grid">
          {filtered.map((game) => {
            const isTracking = tracking === game.id;
            const hours = Math.floor(game.playtime / 60);
            const mins = game.playtime % 60;
            const cardStyle = game.cardColor ? { borderLeft: `3px solid ${game.cardColor}` } : {};
            return (
            <div key={game.id} className="game-card" style={cardStyle} onClick={() => navigate(`/game/${game.id}`)}>
              <div className="game-status-bar" data-status={game.status} />
              {game.coverUrl && <img className="game-cover" src={resolveCoverUrl(game.coverUrl)} alt="" onError={(e) => { e.target.style.display = "none"; }} />}
              <div className="game-card-content">
                <h3 className="game-name">{game.name}</h3>
                <span className="game-platform">{game.platform}</span>
                {game.notes && <p className="game-notes">{game.notes}</p>}
                <div className="game-meta-row">
                  <span className={`game-status-badge status-${game.status}`}>
                    {game.status}
                  </span>
                  <span className="game-playtime">
                    <Clock size={12} />
                    {hours > 0 ? `${hours}h ` : ""}{mins}m
                  </span>
                  {game.rating && (
                    <span className="game-rating-stars">
                      {"★".repeat(game.rating)}{"☆".repeat(5 - game.rating)}
                    </span>
                  )}
                </div>
                {(game.tags || []).length > 0 && (
                  <div className="game-tags">
                    {game.tags.map((gt) => (
                      <span key={gt.tag.id} className="game-tag">{gt.tag.name}</span>
                    ))}
                  </div>
                )}
                {game.localPath && (
                  <p className="game-local-path" title={game.localPath}>
                    {game.localPath.split("\\").pop()}
                  </p>
                )}
                {game.steamAppId && (
                  <p className="game-local-path">Steam App</p>
                )}
              </div>
              <div className="game-card-actions" onClick={(e) => e.stopPropagation()}>
                {(game.localPath || game.steamAppId) && (
                  <button
                    className={`btn-icon ${isTracking ? "btn-icon-stop" : "btn-icon-play"}`}
                    onClick={() => handleLaunch(game)}
                    title={isTracking ? "Stop tracking" : (game.steamAppId ? "Launch via Steam" : "Launch game")}
                  >
                    {isTracking ? <Square size={14} /> : <Play size={14} />}
                  </button>
                )}
                <button className={`btn-icon ${game.pinned ? "btn-icon-active" : ""}`} onClick={async () => {
                  try {
                    await games.togglePin(game.id);
                    fetchGames();
                  } catch (err) {
                    alert(err.message);
                  }
                }} title={game.pinned ? "Unpin" : "Pin to profile"}>
                  <Pin size={14} />
                </button>
                <button className="btn-icon" onClick={() => { setNotesTarget(game); setNotesText(game.notes || ""); }} title="Notes">
                  <FileText size={14} />
                </button>
                <button className="btn-icon" onClick={() => handleEdit(game)}>
                  <Edit3 size={14} />
                </button>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(game.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {notesTarget && (
        <div className="modal-overlay" onClick={() => setNotesTarget(null)}>
          <div className="modal notes-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Notes — {notesTarget.name}</h2>
              <button className="btn-icon" onClick={() => setNotesTarget(null)}>
                <X size={18} />
              </button>
            </div>
            <textarea
              className="form-textarea"
              rows={6}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="Write your thoughts about this game..."
              style={{ marginTop: "0.75rem" }}
            />
            <div className="modal-actions" style={{ marginTop: "0.75rem" }}>
              <button className="btn btn-secondary" onClick={() => setNotesTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  await games.updateNotes(notesTarget.id, notesText);
                  setNotesTarget(null);
                  fetchGames();
                } catch (err) {
                  console.error(err);
                }
              }}>
                <FileText size={14} /> Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanModal && (
        <div className="modal-overlay" onClick={() => setShowScanModal(false)}>
          <div className="modal scan-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Scan Results</h2>
            <p className="setting-desc">Found {scanResults.length} games. Select which to import.</p>
            <div className="scan-list">
              {scanResults.length === 0 ? (
                <p className="empty-text">No games found in this directory.</p>
              ) : (
                scanResults.map((g) => (
                  <label key={g.exePath} className="scan-item">
                    <input
                      type="checkbox"
                      checked={!!selectedScan[g.exePath]}
                      onChange={() => setSelectedScan((prev) => {
                        const next = { ...prev };
                        if (next[g.exePath]) delete next[g.exePath];
                        else next[g.exePath] = true;
                        return next;
                      })}
                    />
                    <div className="scan-item-info">
                      <span className="scan-item-name">{g.name}</span>
                      <span className="scan-item-path">{g.exePath}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowScanModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImportScanned} disabled={Object.keys(selectedScan).length === 0}>
                Import Selected ({Object.keys(selectedScan).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Edit Game" : "Add Game"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Game Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Enter game name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Platform</label>
                  <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Tags</label>
                <div className="tag-selector">
                  {allTags.length === 0 ? (
                    <span className="setting-desc">No tags yet. Add some from the collection page.</span>
                  ) : (
                    allTags.map((t) => (
                      <span
                        key={t.id}
                        className={`tag-chip ${form.tagIds.includes(t.id) ? "tag-chip-active" : ""}`}
                        onClick={() => toggleTag(t.id)}
                      >
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Local File (optional)</label>
                <div className="file-picker-row">
                  <input
                    type="text"
                    value={form.localPath}
                    onChange={(e) => setForm({ ...form, localPath: e.target.value })}
                    placeholder="Path to .exe or shortcut"
                    readOnly={!!window.electronAPI?.pickFile}
                  />
                  {window.electronAPI?.pickFile && (
                    <button type="button" className="btn btn-secondary" onClick={handlePickFile}>
                      <FolderOpen size={16} />
                      Browse
                    </button>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Steam App ID (optional)</label>
                <input
                  type="text"
                  value={form.steamAppId}
                  onChange={(e) => setForm({ ...form, steamAppId: e.target.value })}
                  placeholder="e.g. 730 for CS:GO"
                />
              </div>
              <div className="form-group">
                <label>Cover Image URL (optional)</label>
                <div className="file-picker-row">
                  <input
                    type="text"
                    value={form.coverUrl}
                    onChange={(e) => setForm({ ...form, coverUrl: e.target.value })}
                    placeholder="https://..."
                  />
                  {form.steamAppId && (
                    <button type="button" className="btn btn-secondary" onClick={() => {
                      setForm({ ...form, coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${form.steamAppId}/library_600x900.jpg` });
                    }}>
                      Steam Cover
                    </button>
                  )}
                    <button type="button" className="btn btn-secondary" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/png,image/jpeg,image/gif,image/webp";
                    input.onchange = async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = file.name.split(".").pop().toLowerCase();
                      if (!["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
                        return alert("Only PNG, JPG, GIF, and WebP files are supported for covers.");
                      }
                      try {
                        const result = await games.uploadCover(file);
                        setForm({ ...form, coverUrl: result.coverUrl });
                      } catch (err) {
                        alert("Failed to upload cover: " + err.message);
                      }
                    };
                    input.click();
                  }}>
                    Upload
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? "Save Changes" : "Add Game"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Collection;
