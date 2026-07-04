import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gamepad2,
  PlayCircle,
  CheckCircle2,
  Clock,
  Users,
  Timer,
  Eye,
  User,
  MessageSquare,
  X,
} from "lucide-react";
import { friends, games, chats as chatsApi } from "../api";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import VIPBadge from "../components/VIPBadge";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ backgroundColor: color + "15" }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="stat-info">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </div>
  );
}

function formatPlaytime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function Dashboard({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, playing: 0, completed: 0, backlog: 0, totalPlaytime: 0 });
  const [friendList, setFriendList] = useState([]);
  const [playtimeData, setPlaytimeData] = useState(null);
  const [showPlaytime, setShowPlaytime] = useState(false);
  const [friendLibrary, setFriendLibrary] = useState(null);
  const [showFriendLib, setShowFriendLib] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([games.stats(), friends.list()])
      .then(([statsData, friendsData]) => {
        setStats(statsData);
        setFriendList(friendsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleViewFriendLib = async (friendId) => {
    try {
      const profile = await friends.getProfile(friendId);
      setFriendLibrary(profile);
      setShowFriendLib(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShowPlaytime = async () => {
    try {
      const data = await games.playtimeSummary();
      setPlaytimeData(data);
      setShowPlaytime(true);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.username}</p>
        </div>
      </div>

      <div className="stat-cards">
        <StatCard icon={Gamepad2} label="Total Games" value={stats.total} color="#6366f1" />
        <StatCard icon={PlayCircle} label="Playing" value={stats.playing} color="#22c55e" />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} color="#3b82f6" />
        <StatCard icon={Clock} label="Not Playing" value={stats.backlog} color="#f59e0b" />
        <StatCard icon={Timer} label="Total Playtime" value={formatPlaytime(stats.totalPlaytime)} color="#ec4899" />
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-body quick-actions">
            <button className="btn btn-primary" onClick={() => navigate("/collection")}>
              <Gamepad2 size={16} />
              Manage Collection
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/steam")}>
              <Users size={16} />
              Sync Steam
            </button>
            <button className="btn btn-secondary" onClick={handleShowPlaytime}>
              <Timer size={16} />
              Playtime Details
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Friends</h2>
            <span className="badge">{friendList.length}</span>
          </div>
          <div className="card-body">
            {friendList.length === 0 ? (
              <p className="empty-text">No friends yet. Add some in Settings!</p>
            ) : (
              <ul className="friend-list">
                {friendList.slice(0, 5).map((friend) => (
                  <li key={friend.id} className="friend-item">
                    <AvatarWithDecoration user={friend} size={32} />
                    
                    <div className="friend-info">
                      <span className="friend-name">{friend.displayName || friend.username}{(friend.role === "vip" || friend.role === "admin") && <VIPBadge size={12} />}</span>
                      {friend.steamLink && (
                        <span className={`online-status ${friend.steamLink.onlineStatus > 0 ? "online" : "offline"}`}>
                          {friend.steamLink.onlineStatus > 0 ? "Online" : "Offline"}
                        </span>
                      )}
                    </div>
                    <div className="friend-actions">
                      <button className="btn-icon" onClick={() => navigate(`/profile/${friend.id}`)} title="View profile">
                        <User size={14} />
                      </button>
                      <button className="btn-icon" onClick={async () => {
                        await chatsApi.createOrGet(friend.id);
                        navigate("/chat");
                      }} title="Message">
                        <MessageSquare size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => handleViewFriendLib(friend.id)} title="View library">
                        <Eye size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {showFriendLib && friendLibrary && (
        <div className="modal-overlay" onClick={() => setShowFriendLib(false)}>
          <div className="modal friend-lib-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>{friendLibrary.displayName || friendLibrary.username}{(friendLibrary.role === "vip" || friendLibrary.role === "admin") && <VIPBadge size={14} />}'s Library</h2>
              <button className="btn-icon" onClick={() => setShowFriendLib(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="friend-lib-list">
              {friendLibrary.games.length === 0 ? (
                <p className="empty-text">No games in their collection yet.</p>
              ) : (
                friendLibrary.games.map((g) => (
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

      {showPlaytime && playtimeData && (
        <div className="modal-overlay" onClick={() => setShowPlaytime(false)}>
          <div className="modal playtime-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Playtime Breakdown</h2>
              <button className="btn-icon" onClick={() => setShowPlaytime(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="playtime-total">Total: {formatPlaytime(playtimeData.total)}</p>
            <div className="playtime-list">
              {playtimeData.games.length === 0 ? (
                <p className="empty-text">No playtime recorded yet.</p>
              ) : (
                playtimeData.games.map((g) => (
                  <div key={g.id} className="playtime-item">
                    <div className="playtime-item-info">
                      <span className="playtime-item-name">{g.name}</span>
                      <span className="playtime-item-platform">{g.platform}</span>
                    </div>
                    <span className="playtime-item-value">{formatPlaytime(g.playtime)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
