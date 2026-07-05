import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Key, Users, UserPlus, Check, X, Download, Camera, Eye, User, MessageSquare, Trophy, Lock, Shield, ChevronRight, Pencil } from "lucide-react";
import { settings, friends, auth, goals as goalsApi, admin as adminApi, decorations as decorationsApi, chats as chatsApi } from "../api";
import config, { resolveAssetUrl } from "../config";
import DebugPanel from "../components/DebugPanel";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import VIPBadge from "../components/VIPBadge";
import ShortcutsSettings from "../components/ShortcutsSettings";

function calcLevel(xp) { return Math.floor(Math.pow(xp / 100, 0.6)); }

function Settings({ user, onCheckUpdate, onUserUpdate }) {
  const navigate = useNavigate();

  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendList, setFriendList] = useState([]);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState("success");
  const [devMode, setDevMode] = useState(() => localStorage.getItem("dev-mode") === "true");
  const [tapCount, setTapCount] = useState(0);
  const [friendLib, setFriendLib] = useState(null);
  const [showFriendLib, setShowFriendLib] = useState(false);
  const [goalDefs, setGoalDefs] = useState([]);
  const [decoList, setDecoList] = useState([]);
  const [profileVis, setProfileVis] = useState({ bio: "public", games: "public", stats: "public", badges: "public", friends: "public", currentlyPlaying: "public" });
  const [completedGoals, setCompletedGoals] = useState([]);
  const [adminPass, setAdminPass] = useState("");
  const [adminToken, setAdminToken] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [goalCheckMsg, setGoalCheckMsg] = useState("");
const [editingDecoId, setEditingDecoId] = useState(null);
const [editingDecoName, setEditingDecoName] = useState("");


  useEffect(() => {
    sessionStorage.removeItem("admin-token");
    decorationsApi.list().then(setDecoList).catch(() => {});
    settings.get().then((s) => {
      setCompletedGoals(s.completedGoals ? JSON.parse(s.completedGoals) : []);
    }).catch(console.error);
    goalsApi.list().then(setGoalDefs).catch(console.error);
    settings.getVisibility().then(setProfileVis).catch(() => {});
    refreshFriends();
  }, []);

  const saveVisibility = async () => {
    try {
      await settings.updateVisibility(profileVis);
      setMessage("Visibility updated!");
      setMsgType("success");
    } catch (err) {
      setMessage("Failed to update visibility");
      setMsgType("error");
    }
  };

  const checkGoals = async () => {
    try {
      const res = await goalsApi.check();
      if (res.newCompletions.length > 0) {
        setCompletedGoals(res.completed);
        setUnlockedThemes(res.unlocked);
        setGoalCheckMsg(`Completed: ${res.newCompletions.map((g) => g.name).join(", ")}${res.newUnlocks.length ? " -- New themes unlocked!" : ""}`);
        setTimeout(() => setGoalCheckMsg(""), 5000);
      }
    } catch (err) { console.error(err); }
  };

  const refreshFriends = () => {
    friends.getRequests().then(setFriendRequests).catch(console.error);
    friends.list().then(setFriendList).catch(console.error);
  };

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => setMessage(""), 3000);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPass !== passwords.confirm) {
      showMessage("Passwords do not match", "error");
      return;
    }
    if (passwords.newPass.length < 6) {
      showMessage("Password must be at least 6 characters", "error");
      return;
    }
    try {
      await settings.changePassword(passwords.current, passwords.newPass);
      setPasswords({ current: "", newPass: "", confirm: "" });
      showMessage("Password updated successfully");
    } catch (err) {
      showMessage(err.message, "error");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const result = await friends.search(searchQuery);
      setSearchResult(result);
    } catch (err) {
      showMessage("Search failed", "error");
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      await friends.sendRequest(userId);
      showMessage("Friend request sent!");
      setSearchResult(null);
      setSearchQuery("");
    } catch (err) {
      showMessage(err.message, "error");
    }
  };

  const handleAdminLogin = async () => {
    try {
      const res = await adminApi.auth(adminPass);
      setAdminToken(res.token);
      const users = await adminApi.listUsers(res.token);
      setAdminUsers(users);
      setAdminSelectedUser(null);
      setAdminPass("");
    } catch (err) {
      showMessage(err.message, "error");
    }
  };

  const handleAdminSelectUser = async (id) => {
    if (!adminToken) return;
    const u = await adminApi.getUser(id, adminToken);
    setAdminSelectedUser(u);
  };

  const handleAdminDeleteGame = async (gameId) => {
    if (!adminToken || !confirm("Delete this game?")) return;
    await adminApi.deleteGame(gameId, adminToken);
    handleAdminSelectUser(adminSelectedUser.id);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminUsers([]);
    setAdminSelectedUser(null);
  };

  const handleRequest = async (id, action) => {
    try {
      if (action === "accept") {
        await friends.acceptRequest(id);
      } else {
        await friends.declineRequest(id);
      }
      refreshFriends();
      showMessage(`Request ${action}ed`);
    } catch (err) {
      showMessage("Failed to handle request", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account</p>
        </div>
      </div>

      {message && <div className={`toast toast-${msgType}`}>{message}</div>}

      <div className="settings-sections">

        <div className="card">
          <div className="card-header">
            <h2>Password</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwords.newPass}
                    onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                <Key size={16} />
                Update Password
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Friends</h2>
          </div>
          <div className="card-body">
            <div className="setting-section">
              <h3>Find Friends</h3>
              <div className="search-row">
                <input
                  type="text"
                  placeholder="Search by exact username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="search-input"
                />
                <button className="btn btn-primary" onClick={handleSearch}>
                  <Users size={16} />
                  Search
                </button>
              </div>
              {searchResult && (
                <div className="search-result">
                  <span>{searchResult.displayName || searchResult.username}{(searchResult.role === "vip" || searchResult.role === "admin") && <VIPBadge size={12} />}</span>
                  <button className="btn btn-sm btn-primary" onClick={() => handleSendRequest(searchResult.id)}>
                    <UserPlus size={14} />
                    Add Friend
                  </button>
                </div>
              )}
              {searchResult === null && searchQuery && (
                <p className="empty-text">User not found</p>
              )}
            </div>

            {friendRequests.length > 0 && (
              <div className="setting-section">
                <h3>Pending Requests ({friendRequests.length})</h3>
                {friendRequests.map((req) => (
                  <div key={req.id} className="request-row">
                    <span>{req.sender.displayName || req.sender.username}{(req.sender.role === "vip" || req.sender.role === "admin") && <VIPBadge size={12} />}</span>
                    <div className="request-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => handleRequest(req.id, "accept")}>
                        <Check size={14} />
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleRequest(req.id, "decline")}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="setting-section">
              <h3>Your Friends ({friendList.length})</h3>
              {friendList.length === 0 ? (
                <p className="empty-text">No friends yet. Search above to add some!</p>
              ) : (
                <div className="friend-grid">
                  {friendList.map((f) => (
                    <div key={f.id} className="friend-chip">
                      <AvatarWithDecoration user={f} size={24} />
                      {f.displayName || f.username}{(f.role === "vip" || f.role === "admin") && <VIPBadge size={12} />}
                      <button className="btn-icon btn-icon-sm" onClick={() => navigate(`/profile/${f.id}`)} title="View profile">
                        <User size={12} />
                      </button>
                      <button className="btn-icon btn-icon-sm" onClick={async () => {
                        await chatsApi.createOrGet(f.id);
                        navigate("/chat");
                      }} title="Message">
                        <MessageSquare size={12} />
                      </button>
                      <button className="btn-icon btn-icon-sm" onClick={async () => {
                        const p = await friends.getProfile(f.id);
                        setFriendLib(p);
                        setShowFriendLib(true);
                      }} title="View library">
                        <Eye size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Profile Visibility</h2>
          </div>
          <div className="card-body">
            <p className="setting-hint">Control who can see each section of your profile.</p>
            {Object.entries(profileVis).map(([field, level]) => (
              <div key={field} className="setting-row">
                <span className="setting-label">{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                <select className="form-select" value={level} onChange={(e) => setProfileVis({ ...profileVis, [field]: e.target.value })} style={{ width: "auto" }}>
                  <option value="public">Everyone</option>
                  <option value="friends">Friends Only</option>
                  <option value="private">Only Me</option>
                </select>
              </div>
            ))}
            <button className="btn btn-primary btn-sm" onClick={saveVisibility} style={{ marginTop: "0.5rem" }}>
              <Eye size={14} /> Save Visibility
            </button>
          </div>
        </div>

        {window.electronAPI?.isElectron && (
          <div className="card">
            <div className="card-header">
              <h2>Updates</h2>
            </div>
            <div className="card-body">
              <div className="setting-row">
                <div className="setting-info">
                  <span
                    className="setting-label version-tap"
                    onClick={() => {
                      const next = tapCount + 1;
                      setTapCount(next);
                      if (next >= 5) {
                        setTapCount(0);
                        localStorage.setItem("dev-mode", "true");
                        setDevMode(true);
                      }
                      setTimeout(() => setTapCount(0), 3000);
                    }}
                  >
                    GameVault v{__APP_VERSION__}
                  </span>
                  <span className="setting-desc">Check if a newer version is available</span>
                </div>
                <button className="btn btn-primary" onClick={onCheckUpdate}>
                  <Download size={16} />
                  Check for Updates
                </button>
              </div>
              {devMode && (
                <p className="setting-desc" style={{ marginTop: "0.5rem", color: "var(--accent)" }}>
                  Developer mode active
                </p>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h2><Trophy size={18} /> Goals</h2>
          </div>
          <div className="card-body">
            {goalCheckMsg && <div className="message message-success">{goalCheckMsg}</div>}
            <button className="btn btn-primary" onClick={checkGoals} style={{ marginBottom: "1rem" }}>
              <Trophy size={16} /> Check Progress
            </button>
            <div className="goals-list">
              {goalDefs.map((g) => {
                const done = completedGoals.includes(g.id);
                return (
                  <div key={g.id} className={`goal-item ${done ? "goal-done" : ""}`}>
                    <div className="goal-info">
                      <span className="goal-name">{g.name}</span>
                      <span className="goal-desc">{g.desc}</span>
                      {g.unlock && <span className="goal-unlock">Unlocks: {g.unlock}</span>}
                    </div>
                    <div className="goal-status">{done ? <Check size={16} /> : <Lock size={16} />}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <ShortcutsSettings />

        <div className="card">
          <div className="card-header">
            <h2><Shield size={18} /> Admin Panel</h2>
          </div>
          <div className="card-body">
            {!adminToken ? (
              <div className="admin-login">
                <p>Enter the admin password to manage users.</p>
                <div className="search-row">
                  <input type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()} placeholder="Admin password" />
                  <button className="btn btn-primary" onClick={handleAdminLogin}>
                    <Shield size={16} /> Login
                  </button>
                </div>
              </div>
            ) : (
              <div className="admin-content">
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                  <button className="btn btn-sm btn-secondary" onClick={handleAdminLogout}>Logout</button>
                </div>
                <div className="admin-user-list">
                  {adminUsers.length === 0 ? (
                    <p className="empty-text">No users found. Check server console for errors.</p>
                  ) : (
                    adminUsers.map((u) => (
                      <div key={u.id} className={`admin-user-row ${adminSelectedUser?.id === u.id ? "admin-user-active" : ""}`}
                        onClick={() => handleAdminSelectUser(u.id)}>
                        <span><strong>{u.username}</strong>{(u.role === "vip" || u.role === "admin") && <VIPBadge size={12} />} <span className="admin-role-badge">{u.role || "user"}</span></span>
                        <span className="admin-user-stats">ID: {u.id}</span>
                        <ChevronRight size={14} />
                      </div>
                    ))
                  )}
                </div>
                {adminSelectedUser && (
                  <div className="admin-user-detail">
                    <h3>{adminSelectedUser.username}{(adminSelectedUser.role === "vip" || adminSelectedUser.role === "admin") && <VIPBadge size={14} />}</h3>
                    <div className="setting-row">
                      <div className="setting-info">
                        <span className="setting-label">Role</span>
                      </div>
                      <select className="form-select" value={adminSelectedUser.role || "user"}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          await adminApi.updateUser(adminSelectedUser.id, { role: newRole }, adminToken);
                          setAdminSelectedUser({ ...adminSelectedUser, role: newRole });
                          setAdminUsers(adminUsers.map((u) => u.id === adminSelectedUser.id ? { ...u, role: newRole } : u));
                        }}>
                        <option value="user">User</option>
                        <option value="vip">VIP</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span className="setting-label">XP / Level</span>
                        <span className="setting-desc">Current level: {calcLevel(adminSelectedUser.xp || 0)}</span>
                      </div>
                      <input type="number" className="form-input" style={{ width: 100 }} value={adminSelectedUser.xp || 0}
                        onChange={async (e) => {
                          const newXp = parseInt(e.target.value) || 0;
                          await adminApi.updateUser(adminSelectedUser.id, { xp: newXp }, adminToken);
                          setAdminSelectedUser({ ...adminSelectedUser, xp: newXp });
                          setAdminUsers(adminUsers.map((u) => u.id === adminSelectedUser.id ? { ...u, xp: newXp } : u));
                        }} />
                    </div>

                    <h4>Unlocked Themes</h4>
                    <div className="admin-toggle-grid">
                      {[
                        { id: "midnight", label: "Midnight" },
                        { id: "forest", label: "Forest" },
                        { id: "nord", label: "Nord" },
                        { id: "sunset", label: "Sunset" },
                        { id: "crimson", label: "Crimson" },
                        { id: "ocean", label: "Ocean" },
                        { id: "cyberpunk", label: "Cyberpunk" },
                        { id: "matrix", label: "Matrix" },
                        { id: "royal", label: "Royal" },
                      ].map((t) => {
                        const unlocked = adminSelectedUser.unlockedThemes?.includes(t.id) || false;
                        return (
                          <label key={t.id} className="admin-toggle-row">
                            <input type="checkbox" checked={unlocked}
                              onChange={async (e) => {
                                const newUnlocked = e.target.checked
                                  ? [...(adminSelectedUser.unlockedThemes || []), t.id]
                                  : (adminSelectedUser.unlockedThemes || []).filter((x) => x !== t.id);
                                await adminApi.updateUser(adminSelectedUser.id, { unlockThemes: newUnlocked, completeGoals: adminSelectedUser.completedGoals || [] }, adminToken);
                                setAdminSelectedUser({ ...adminSelectedUser, unlockedThemes: newUnlocked });
                              }} />
                            <span>{t.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    <h4>Completed Goals</h4>
                    <div className="admin-toggle-grid">
                      {goalDefs.map((g) => {
                        const done = adminSelectedUser.completedGoals?.includes(g.id) || false;
                        return (
                          <label key={g.id} className="admin-toggle-row">
                            <input type="checkbox" checked={done}
                              onChange={async (e) => {
                                const newCompleted = e.target.checked
                                  ? [...(adminSelectedUser.completedGoals || []), g.id]
                                  : (adminSelectedUser.completedGoals || []).filter((x) => x !== g.id);
                                await adminApi.updateUser(adminSelectedUser.id, { unlockThemes: adminSelectedUser.unlockedThemes || [], completeGoals: newCompleted }, adminToken);
                                setAdminSelectedUser({ ...adminSelectedUser, completedGoals: newCompleted });
                              }} />
                            <span>{g.name}</span>
                          </label>
                        );
                      })}
                    </div>

                    <h4>Games ({adminSelectedUser.games?.length || 0})</h4>
                    <div className="admin-game-list">
                      {(adminSelectedUser.games || []).map((g) => (
                        <div key={g.id} className="admin-game-row">
                          <span>{g.name}</span>
                          <button className="btn btn-sm btn-danger" onClick={() => handleAdminDeleteGame(g.id)}>
                            <X size={12} /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
            )}
            {adminToken && (
              <div className="admin-decoration-section" style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <h4>Decoration Manager</h4>
                <div className="admin-deco-upload">
                  <label className="btn btn-sm btn-secondary">
                    <Camera size={12} /> Upload Decoration
                    <input type="file" accept="image/gif,image/png,image/webp" hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("decoration", file);
                        try {
                          const res = await fetch(`${config.API_BASE}/admin/decorations`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${adminToken}` },
                            body: formData,
                          });
                          if (!res.ok) throw new Error((await res.json()).error);
                          const deco = await res.json();
                          setDecoList([...decoList, deco]);
                          showMessage("Decoration uploaded");
                        } catch (err) { showMessage(err.message, "error"); }
                      }} />
                  </label>
                </div>
                <div className="admin-deco-list">
                  {decoList.map((d) => (
                    <div key={d.id} className="admin-game-row">
                      {editingDecoId === d.id ? (
                        <div className="search-row" style={{ flex: 1 }}>
                          <input type="text" value={editingDecoName} onChange={(e) => setEditingDecoName(e.target.value)}
                            className="search-input" autoFocus onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                try {
                                  const res = await fetch(`${config.API_BASE}/admin/decorations/${d.id}`, {
                                    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
                                    body: JSON.stringify({ name: editingDecoName }),
                                  });
                                  if (!res.ok) throw new Error((await res.json()).error);
                                  const updated = await res.json();
                                  setDecoList(decoList.map((x) => x.id === d.id ? updated : x));
                                  setEditingDecoId(null);
                                } catch (err) { showMessage(err.message, "error"); }
                              }
                              if (e.key === "Escape") setEditingDecoId(null);
                            }} />
                          <button className="btn-icon btn-icon-sm" onClick={() => setEditingDecoId(null)}><X size={12} /></button>
                        </div>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <img src={resolveAssetUrl(d.fileUrl)} alt={d.name}
                            style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 4, background: "var(--surface)" }} />
                          {d.name}
                        </span>
                      )}
                      <button className="btn-icon btn-icon-sm" onClick={() => { setEditingDecoId(d.id); setEditingDecoName(d.name); }} title="Rename">
                        <Pencil size={12} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={async () => {
                        if (!confirm(`Delete "${d.name}"?`)) return;
                        try {
                          await fetch(`${config.API_BASE}/admin/decorations/${d.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${adminToken}` },
                          });
                          setDecoList(decoList.filter((x) => x.id !== d.id));
                          showMessage("Decoration deleted");
                        } catch (err) { showMessage(err.message, "error"); }
                      }}>
                        <X size={12} /> Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AdminBadges adminToken={adminToken} />
          </div>
        </div>

        {showFriendLib && friendLib && (
          <div className="modal-overlay" onClick={() => setShowFriendLib(false)}>
            <div className="modal friend-lib-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-row">
                <h2>{friendLib.displayName || friendLib.username}{(friendLib.role === "vip" || friendLib.role === "admin") && <VIPBadge size={14} />}'s Library</h2>
                <button className="btn-icon" onClick={() => setShowFriendLib(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="friend-lib-list">
                {friendLib.games.length === 0 ? (
                  <p className="empty-text">No games in their collection yet.</p>
                ) : (
                  friendLib.games.map((g) => (
                    <div key={g.id} className="friend-lib-item">
                      <div className="friend-lib-item-info">
                        <span className="friend-lib-item-name">{g.name}</span>
                        <span className="friend-lib-item-platform">{g.platform}</span>
                        {(g.tags || []).length > 0 && (
                          <div className="game-tags" style={{ marginTop: "0.25rem" }}>
                            {g.tags.map((gt) => (
                              <span key={gt.tag.id} className="game-tag">{gt.tag.name}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="playtime-item-value">
                        {Math.floor(g.playtime / 60)}h {g.playtime % 60}m
                      </span>
                    </div>
                  ))
            )}
          </div>
        </div>
      </div>
    )}

        {devMode && (
          <>
            <DebugPanel />
            <div className="card">
              <div className="card-body" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {window.electronAPI?.openDevTools && (
                  <button className="btn btn-secondary" onClick={() => window.electronAPI.openDevTools()}>
                    Open DevTools
                  </button>
                )}
                <button className="btn btn-secondary btn-danger" onClick={() => {
                  localStorage.removeItem("dev-mode");
                  setDevMode(false);
                }}>
                  Exit Developer Mode
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminBadges({ adminToken }) {
  const [badgeList, setBadgeList] = useState([]);
  const [newBadgeName, setNewBadgeName] = useState("");
  const [newBadgeDesc, setNewBadgeDesc] = useState("");
  const [newBadgeIcon, setNewBadgeIcon] = useState("");
  const [awardBadgeId, setAwardBadgeId] = useState(null);
  const [awardUserId, setAwardUserId] = useState("");
  const [awardNote, setAwardNote] = useState("");
  const [badgeMessage, setBadgeMessage] = useState("");
  const [showCreateBadge, setShowCreateBadge] = useState(false);

  useEffect(() => {
    adminApi.listBadges(adminToken).then(setBadgeList).catch(() => {});
  }, []);

  const showBadgeMsg = (text) => { setBadgeMessage(text); setTimeout(() => setBadgeMessage(""), 3000); };

  return (
    <div className="admin-decoration-section" style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
      <h4>Badges</h4>
      {badgeMessage && <div className="toast toast-success" style={{ marginBottom: "0.5rem" }}>{badgeMessage}</div>}

      <button className="btn btn-sm btn-primary" onClick={() => setShowCreateBadge(!showCreateBadge)} style={{ marginBottom: "0.75rem" }}>
        {showCreateBadge ? "Cancel" : "Create Badge"}
      </button>

      {showCreateBadge && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
          <input className="form-input" value={newBadgeName} onChange={(e) => setNewBadgeName(e.target.value)} placeholder="Badge name" />
          <input className="form-input" value={newBadgeDesc} onChange={(e) => setNewBadgeDesc(e.target.value)} placeholder="Description (optional)" />
          <input className="form-input" value={newBadgeIcon} onChange={(e) => setNewBadgeIcon(e.target.value)} placeholder="Icon URL (Cloudinary URL)" />
          <button className="btn btn-primary btn-sm" onClick={async () => {
            if (!newBadgeName) return;
            try {
              const badge = await adminApi.createBadge({ name: newBadgeName, description: newBadgeDesc, iconUrl: newBadgeIcon || undefined }, adminToken);
              setBadgeList([badge, ...badgeList]);
              setNewBadgeName(""); setNewBadgeDesc(""); setNewBadgeIcon("");
              setShowCreateBadge(false);
              showBadgeMsg("Badge created!");
            } catch (err) { showBadgeMsg(err.message); }
          }}>Save Badge</button>
        </div>
      )}

      {badgeList.length === 0 ? (
        <p className="empty-text" style={{ fontSize: "0.8rem" }}>No badges created yet.</p>
      ) : (
        <div className="admin-game-list">
          {badgeList.map((b) => (
            <div key={b.id} className="admin-game-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                {b.iconUrl ? <img src={resolveAssetUrl(b.iconUrl)} alt="" style={{ width: 24, height: 24, objectFit: "contain", borderRadius: 4 }} /> : <Shield size={18} />}
                <div style={{ minWidth: 0 }}>
                  <strong>{b.name}</strong>
                  {b.description && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>{b.description}</span>}
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>{b._count?.users || 0} awarded</span>
                </div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setAwardBadgeId(awardBadgeId === b.id ? null : b.id)} style={{ fontSize: "0.7rem" }}>
                Award
              </button>
              <button className="btn btn-sm btn-danger" onClick={async () => {
                if (!confirm(`Delete "${b.name}" and revoke from all users?`)) return;
                try {
                  await adminApi.deleteBadge(b.id, adminToken);
                  setBadgeList(badgeList.filter((x) => x.id !== b.id));
                  showBadgeMsg("Badge deleted");
                } catch (err) { showBadgeMsg(err.message); }
              }} style={{ fontSize: "0.7rem" }}><X size={12} /></button>

              {awardBadgeId === b.id && (
                <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <input className="form-input" style={{ width: 80 }} value={awardUserId} onChange={(e) => setAwardUserId(e.target.value)} placeholder="User ID" type="number" min="1" />
                  <input className="form-input" style={{ width: 120 }} value={awardNote} onChange={(e) => setAwardNote(e.target.value)} placeholder="Note (optional)" />
                  <button className="btn btn-sm btn-primary" style={{ fontSize: "0.7rem" }} onClick={async () => {
                    if (!awardUserId) return;
                    try {
                      const ubid = parseInt(awardUserId);
                      await adminApi.awardBadge(b.id, ubid, awardNote || undefined, adminToken);
                      showBadgeMsg(`Badge awarded to user ${ubid}`);
                      setAwardUserId(""); setAwardNote(""); setAwardBadgeId(null);
                      setBadgeList(badgeList.map((x) => x.id === b.id ? { ...x, _count: { users: (x._count?.users || 0) + 1 } } : x));
                    } catch (err) { showBadgeMsg(err.message); }
                  }}>Give</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Settings;
