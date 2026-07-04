import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Edit3, Save, X, Tag } from "lucide-react";
import { games, tags as tagsApi } from "../api";

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

  useEffect(() => {
    games.getById(id).then((g) => {
      setGame(g);
      setForm({ status: g.status, notes: g.notes || "", review: g.review || "", tagIds: (g.tags || []).map((gt) => gt.tag.id) });
      setLoading(false);
    }).catch(() => navigate("/collection"));
    tagsApi.list().then(setAllTags).catch(console.error);
    games.getSessions(id).then(setSessions).catch(console.error);
  }, [id]);

  const handleSave = async () => {
    try {
      const updated = await games.update(id, form);
      setGame(updated);
      setEditing(false);
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
        {game.coverUrl && <img className="game-detail-cover" src={game.coverUrl} alt="" onError={(e) => { e.target.style.display = "none"; }} />}
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
    </div>
  );
}

export default GameDetail;
