import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Gamepad2, PlayCircle, CheckCircle2, Clock, Timer, Trophy, Pencil, Check, X, MessageSquare, Pin, Zap } from "lucide-react";
import { users as usersApi, settings as settingsApi, chats as chatsApi } from "../api";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import VIPBadge from "../components/VIPBadge";
import config, { resolveAssetUrl } from "../config";

function calcLevel(xp) { return Math.floor(Math.pow(xp / 100, 0.6)); }

function Profile({ user: currentUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState("");
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameText, setDisplayNameText] = useState("");

  const isOwn = currentUser?.id === parseInt(id);

  useEffect(() => {
    if (id) {
      setLoading(true);
      usersApi.getProfile(id)
        .then(setProfile)
        .catch(() => { navigate("/"); })
        .finally(() => setLoading(false));
    }
  }, [id]);

  const saveBio = async () => {
    try {
      const updated = await settingsApi.updateBio(bioText);
      setProfile({ ...profile, bio: updated.bio });
      setEditingBio(false);
    } catch (err) {
      console.error(err);
    }
  };

  const saveDisplayName = async () => {
    try {
      const updated = await settingsApi.updateDisplayName(displayNameText);
      setProfile({ ...profile, displayName: updated.displayName });
      setEditingDisplayName(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="page"><div className="loading-spinner" /></div>;
  }

  if (!profile) return null;

  const accentColor = profile.accentColor || "var(--accent)";
  const pinnedGames = profile.games.filter((g) => g.pinned);
  const otherGames = profile.games.filter((g) => !g.pinned);

  return (
    <div className="page" style={{ "--profile-accent": accentColor }}>
      <button className="btn btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div className={`profile-banner-wrap ${profile.bannerUrl ? "has-banner" : ""}`}>
        {profile.bannerUrl && (
          <div className="profile-banner">
            {profile.bannerCrop ? (
              (() => {
                const c = JSON.parse(profile.bannerCrop);
                return (
                  <div style={{
                    width: "100%", height: "100%", overflow: "hidden", position: "relative",
                  }}>
                    <img src={resolveAssetUrl(profile.bannerUrl)} alt=""
                      style={{
                        position: "absolute",
                        width: `${100 / c.width}%`,
                        height: `${100 / c.height}%`,
                        left: `${-c.x * (100 / c.width)}%`,
                        top: `${-c.y * (100 / c.height)}%`,
                        maxWidth: "none",
                      }} />
                  </div>
                );
              })()
            ) : (
              <img src={resolveAssetUrl(profile.bannerUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}
          </div>
        )}
        <div className="profile-header">
          <AvatarWithDecoration user={profile} size={96} />
          <div className="profile-info">
            <div className="profile-name-row">
              {editingDisplayName ? (
                <div className="profile-name-edit">
                  <input type="text" value={displayNameText} onChange={(e) => setDisplayNameText(e.target.value)}
                    className="profile-name-input" placeholder="Display name" maxLength={30} autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveDisplayName(); if (e.key === "Escape") setEditingDisplayName(false); }} />
                  <button className="btn-icon" onClick={saveDisplayName} title="Save"><Check size={16} /></button>
                  <button className="btn-icon" onClick={() => setEditingDisplayName(false)} title="Cancel"><X size={16} /></button>
                </div>
              ) : (
                <h1 className="profile-name-display">
                  {profile.displayName || profile.username}{(profile.role === "vip" || profile.role === "admin") && <VIPBadge size={16} />}
                  {isOwn && (
                    <button className="btn-icon" onClick={() => { setDisplayNameText(profile.displayName || ""); setEditingDisplayName(true); }} title="Edit display name">
                      <Pencil size={14} />
                    </button>
                  )}
                </h1>
              )}
            </div>
            {profile.status && <p className="profile-status">{profile.status}</p>}
            <p className="profile-joined">@{profile.username} &middot; Joined {new Date(profile.createdAt).toLocaleDateString()}</p>
            {profile.steamLink?.displayName && (
              <p className="profile-steam">Steam: {profile.steamLink.displayName}</p>
            )}
            {!isOwn && (
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                try {
                  const convo = await chatsApi.createOrGet(profile.id);
                  navigate("/chat");
                } catch (err) { console.error(err); }
              }}>
                <MessageSquare size={14} /> Message
              </button>
            )}
            <div className="profile-bio">
              {editingBio ? (
                <div className="profile-bio-edit">
                  <textarea value={bioText} onChange={(e) => setBioText(e.target.value)}
                    className="form-textarea" rows={3} maxLength={500} placeholder="Write something about yourself..." />
                  <div className="profile-bio-actions">
                    <button className="btn btn-primary btn-sm" onClick={saveBio}><Check size={14} /> Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingBio(false)}><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="profile-bio-display">
                  <p>{profile.bio || "No bio yet."}</p>
                  {isOwn && (
                    <button className="btn-icon" onClick={() => { setBioText(profile.bio || ""); setEditingBio(true); }} title="Edit bio">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card"><Trophy size={20} /><span>{profile.stats.total} Games</span></div>
        <div className="stat-card" style={{ "--stat-color": "#22c55e" }}><PlayCircle size={20} /><span>{profile.stats.playing} Playing</span></div>
        <div className="stat-card" style={{ "--stat-color": "#3b82f6" }}><CheckCircle2 size={20} /><span>{profile.stats.completed} Completed</span></div>
        <div className="stat-card" style={{ "--stat-color": "#f59e0b" }}><Clock size={20} /><span>{profile.stats.notPlaying} Not Playing</span></div>
        <div className="stat-card" style={{ "--stat-color": "#ec4899" }}><Timer size={20} /><span>{Math.floor(profile.stats.totalPlaytime / 60)}h {profile.stats.totalPlaytime % 60}m Total</span></div>
        {profile.xp !== undefined && (
          <div className="stat-card" style={{ "--stat-color": "#a855f7" }}><Zap size={20} /><span>Lv.{calcLevel(profile.xp)} ({profile.xp} XP)</span></div>
        )}
              </div>

      {pinnedGames.length > 0 && (
        <div className="card">
          <div className="card-header"><h2><Pin size={16} /> Pinned Games ({pinnedGames.length})</h2></div>
          <div className="card-body">
            <div className="profile-game-list">
              {pinnedGames.map((g) => (
                <div key={g.id} className="profile-game-row profile-game-pinned">
                  <div className="profile-game-info">
                    <span className="profile-game-name">{g.name}</span>
                    <span className="profile-game-platform">{g.platform}</span>
                    {(g.tags || []).length > 0 && (
                      <div className="game-tags">
                        {g.tags.map((gt) => (
                          <span key={gt.tag.id} className="game-tag">{gt.tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="profile-game-meta">
                    <span className="profile-game-status" data-status={g.status}>{g.status}</span>
                    <span className="profile-game-playtime"><Timer size={14} /> {Math.floor(g.playtime / 60)}h {g.playtime % 60}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Games ({otherGames.length})</h2></div>
        <div className="card-body">
          <div className="profile-game-list">
            {otherGames.length === 0 && pinnedGames.length === 0 ? (
              <p className="empty-text">No games in their collection yet.</p>
            ) : otherGames.length === 0 ? (
              <p className="empty-text">No more games to show.</p>
            ) : (
              otherGames.map((g) => (
                <div key={g.id} className="profile-game-row">
                  <div className="profile-game-info">
                    <span className="profile-game-name">{g.name}</span>
                    <span className="profile-game-platform">{g.platform}</span>
                    {(g.tags || []).length > 0 && (
                      <div className="game-tags">
                        {g.tags.map((gt) => (
                          <span key={gt.tag.id} className="game-tag">{gt.tag.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="profile-game-meta">
                    <span className="profile-game-status" data-status={g.status}>{g.status}</span>
                    <span className="profile-game-playtime"><Timer size={14} /> {Math.floor(g.playtime / 60)}h {g.playtime % 60}m</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
