import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Edit3, Save, X, Tag, Plus, Trash2, RefreshCw, Image, CheckSquare, Square, Upload } from "lucide-react";
import { games, tags as tagsApi } from "../api";
import { resolveCoverUrl } from "../config";

const STATUSES = ["not-playing", "playing", "completed", "dropped"];

function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [allTags, setAllTags] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [servers, setServers] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [newServerHost, setNewServerHost] = useState("");
  const [newServerPort, setNewServerPort] = useState("");
  const [newServerLabel, setNewServerLabel] = useState("");
  const [serverStatuses, setServerStatuses] = useState({});
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [enlargeScreenshot, setEnlargeScreenshot] = useState(null);

  useEffect(() => {
    games.getById(id).then((g) => {
      setGame(g);
      setForm({ status: g.status, notes: g.notes || "", review: g.review || "", tagIds: (g.tags || []).map((gt) => gt.tag.id), cardColor: g.cardColor || "" });
      setLoading(false);
    }).catch(() => navigate("/collection"));
    tagsApi.list().then(setAllTags).catch(console.error);
    games.getSessions(id).then(setSessions).catch(console.error);
    games.servers.list(id).then(setServers).catch(console.error);
    games.screenshots.list(id).then(setScreenshots).catch(console.error);
    games.milestones.list(id).then(setMilestones).catch(console.error);
  }, [id]);

  const handleSave = async () => {
    try {
      const updated = await games.update(id, form);
      if (form.cardColor !== undefined) {
        await games.updateCardColor(id, form.cardColor || null);
        updated.cardColor = form.cardColor || null;
      }
      setGame(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckServer = async (host, port) => {
    try {
      const result = await games.servers.check(host, port);
      setServerStatuses((prev) => ({ ...prev, [`${host}:${port}`]: result.online }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddServer = async (e) => {
    e.preventDefault();
    try {
      await games.servers.add(id, { host: newServerHost, port: parseInt(newServerPort), label: newServerLabel });
      const updated = await games.servers.list(id);
      setServers(updated);
      setNewServerHost("");
      setNewServerPort("");
      setNewServerLabel("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteServer = async (serverId) => {
    try {
      await games.servers.delete(serverId);
      setServers(servers.filter((s) => s.id !== serverId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    try {
      const m = await games.milestones.create(id, newMilestoneTitle.trim());
      setMilestones([m, ...milestones]);
      setNewMilestoneTitle("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMilestone = async (milestoneId) => {
    try {
      const updated = await games.milestones.toggle(milestoneId);
      setMilestones(milestones.map((m) => (m.id === milestoneId ? updated : m)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMilestone = async (milestoneId) => {
    try {
      await games.milestones.delete(milestoneId);
      setMilestones(milestones.filter((m) => m.id !== milestoneId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadScreenshot = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await games.screenshots.upload(id, file);
      const updated = await games.screenshots.list(id);
      setScreenshots(updated);
    } catch (err) {
      console.error(err);
    }
    e.target.value = "";
  };

  const handleDeleteScreenshot = async (screenshotId) => {
    try {
      await games.screenshots.delete(screenshotId);
      setScreenshots(screenshots.filter((s) => s.id !== screenshotId));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!game) return null;

  const tagNames = (game.tags || []).map((gt) => gt.tag.name);
  const hours = Math.floor(game.playtime / 60);
  const mins = game.playtime % 60;

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Back
        </button>
        <button className="btn btn-primary" onClick={() => editing ? handleSave() : setEditing(true)}>
          {editing ? <><Save size={18} /> Save</> : <><Edit3 size={18} /> Edit</>}
        </button>
      </div>

        <div className="game-detail-card">
        {game.coverUrl && <img className="game-detail-cover" src={resolveCoverUrl(game.coverUrl)} alt="" onLoad={(e) => { if (e.target.naturalWidth === 0) e.target.style.display = "none"; }} onError={(e) => { e.target.style.display = "none"; }} />}
        <div className="game-detail-header">
          <h1>{game.name}</h1>
          <span className={`game-status status-${game.status}`}>{game.status}</span>
        </div>

        <div className="game-detail-stats">
          <div className="stat-card">
            <Clock size={20} />
            <div>
              <span className="stat-label">Playtime</span>
              <span className="stat-value">{hours}h {mins}m</span>
            </div>
          </div>
          <div className="stat-card">
            <Tag size={20} />
            <div>
              <span className="stat-label">Tags</span>
              <span className="stat-value">{tagNames.length > 0 ? tagNames.join(", ") : "None"}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="star-rating">
              <span className="stat-label">Rating</span>
              <div className="stars">
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`star ${(game.rating || 0) >= s ? "star-filled" : "star-empty"}`}
                    onClick={async () => {
                      try {
                        const updated = await games.updateRating(id, game.rating === s ? null : s);
                        setGame(updated);
                      } catch (err) { console.error(err); }
                    }}>
                    ★
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="chart-section">
            <h3>Playtime History</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sessions.map((s) => ({ date: new Date(s.createdAt).toLocaleDateString(), minutes: s.minutes }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="minutes" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="game-detail-info">
          <div className="info-row"><span>Platform</span><span>{game.platform}</span></div>
          {game.steamAppId && <div className="info-row"><span>Steam App ID</span><span>{game.steamAppId}</span></div>}
          {game.localPath && <div className="info-row"><span>Local Path</span><span className="path-text">{game.localPath}</span></div>}
          <div className="info-row"><span>Added</span><span>{new Date(game.createdAt).toLocaleDateString()}</span></div>
        </div>

        {editing && (
          <div className="edit-section">
            <h3>Edit Game</h3>
            <label>Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Notes
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
            </label>
            <label>Review
              <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} rows={3} placeholder="Write your review..." />
            </label>
            <label>Tags
              <div className="tag-selector">
                {allTags.map((t) => (
                  <label key={t.id} className="tag-checkbox">
                    <input type="checkbox" checked={form.tagIds.includes(t.id)} onChange={() => {
                      setForm({ ...form, tagIds: form.tagIds.includes(t.id) ? form.tagIds.filter((tid) => tid !== t.id) : [...form.tagIds, t.id] });
                    }} />
                    {t.name}
                  </label>
                ))}
              </div>
            </label>
      <label>Card Color
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="color" value={form.cardColor || "#6366f1"} onChange={(e) => setForm({ ...form, cardColor: e.target.value })} style={{ width: "40px", height: "32px", padding: "2px", border: "1px solid var(--border)", borderRadius: "4px" }} />
          <input type="text" value={form.cardColor} onChange={(e) => setForm({ ...form, cardColor: e.target.value })} placeholder="#6366f1" className="input" style={{ flex: 1 }} />
          {form.cardColor && <button className="btn btn-sm" onClick={() => setForm({ ...form, cardColor: "" })}>Clear</button>}
        </div>
      </label>
      <div className="edit-actions">
        <button className="btn btn-secondary" onClick={() => setEditing(false)}><X size={16} /> Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}><Save size={16} /> Save</button>
      </div>
          </div>
        )}

        {game.notes && !editing && (
          <div className="notes-section">
            <h3>Notes</h3>
            <p>{game.notes}</p>
          </div>
        )}

        {game.review && !editing && (
          <div className="notes-section">
            <h3>Review</h3>
            <p>{game.review}</p>
          </div>
        )}
      </div>

      <div className="game-detail-card">
        <h3>Server Status</h3>
        {servers.length > 0 && (
          <div className="server-list">
            {servers.map((server) => (
              <div key={server.id} className="server-row">
                <div className="server-info">
                  <span className="server-label">{server.label || `${server.host}:${server.port}`}</span>
                  <span className="server-address">{server.host}:{server.port}</span>
                  {serverStatuses[`${server.host}:${server.port}`] !== undefined && (
                    <span className={`server-status-badge ${serverStatuses[`${server.host}:${server.port}`] ? "server-online" : "server-offline"}`}>
                      {serverStatuses[`${server.host}:${server.port}`] ? "Online" : "Offline"}
                    </span>
                  )}
                </div>
                <div className="server-actions">
                  <button className="btn-icon" onClick={() => handleCheckServer(server.host, server.port)} title="Check status">
                    <RefreshCw size={14} />
                  </button>
                  <button className="btn-icon btn-icon-danger" onClick={() => handleDeleteServer(server.id)} title="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <form className="server-add-form" onSubmit={handleAddServer}>
          <input type="text" value={newServerLabel} onChange={(e) => setNewServerLabel(e.target.value)} placeholder="Label (optional)" className="form-input" />
          <input type="text" value={newServerHost} onChange={(e) => setNewServerHost(e.target.value)} placeholder="Host" required className="form-input" />
          <input type="number" value={newServerPort} onChange={(e) => setNewServerPort(e.target.value)} placeholder="Port" required className="form-input" style={{ width: 100 }} />
          <button type="submit" className="btn btn-primary btn-sm"><Plus size={14} /> Add</button>
        </form>
      </div>

      <div className="game-detail-card">
        <h3>Screenshots</h3>
        <div className="screenshot-grid">
          {screenshots.map((s) => (
            <div key={s.id} className="screenshot-item">
              <img src={s.url} alt={s.caption || ""} className="screenshot-thumb" onClick={() => setEnlargeScreenshot(s)} />
              <button className="btn-icon btn-icon-danger screenshot-delete" onClick={() => handleDeleteScreenshot(s.id)} title="Delete">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <label className="screenshot-upload-btn">
            <Upload size={24} />
            <input type="file" accept="image/*" onChange={handleUploadScreenshot} hidden />
          </label>
        </div>
      </div>

      {enlargeScreenshot && (
        <div className="modal-overlay" onClick={() => setEnlargeScreenshot(null)}>
          <div className="screenshot-modal" onClick={(e) => e.stopPropagation()}>
            <img src={enlargeScreenshot.url} alt={enlargeScreenshot.caption || ""} className="screenshot-enlarged" />
            {enlargeScreenshot.caption && <p className="screenshot-caption">{enlargeScreenshot.caption}</p>}
            <button className="btn-icon screenshot-modal-close" onClick={() => setEnlargeScreenshot(null)}><X size={18} /></button>
          </div>
        </div>
      )}

      <div className="game-detail-card">
        <h3>Milestones</h3>
        <div className="milestone-input-row">
          <input type="text" value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} placeholder="New milestone..." className="form-input" onKeyDown={(e) => e.key === "Enter" && handleAddMilestone()} />
          <button className="btn btn-primary btn-sm" onClick={handleAddMilestone}><Plus size={14} /></button>
        </div>
        <div className="milestone-list">
          {milestones.length === 0 ? (
            <p className="empty-text">No milestones yet.</p>
          ) : (
            milestones.map((m) => (
              <div key={m.id} className={`milestone-row ${m.completed ? "milestone-completed" : ""}`}>
                <button className="btn-icon" onClick={() => handleToggleMilestone(m.id)}>
                  {m.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
                <span className="milestone-title">{m.title}</span>
                <button className="btn-icon btn-icon-danger" onClick={() => handleDeleteMilestone(m.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default GameDetail;
