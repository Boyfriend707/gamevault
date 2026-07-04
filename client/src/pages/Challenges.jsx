import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Plus, Gamepad2, Users, Calendar, Clock, ChevronRight, X, Flame } from "lucide-react";
import { challenges as challengesApi, games, dailyChallenges as dailyChallengesApi } from "../api";

function Challenges() {
  const navigate = useNavigate();
  const [challengeList, setChallengeList] = useState([]);
  const [gameList, setGameList] = useState([]);
  const [dailyChallengesList, setDailyChallengesList] = useState([]);
  const [loginStreak, setLoginStreak] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [form, setForm] = useState({ name: "", gameId: "", endDate: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
    games.list().then(setGameList).catch(console.error);
    dailyChallengesApi.list().then((list) => setDailyChallengesList(list)).catch(console.error);
    dailyChallengesApi.check().then((data) => setLoginStreak(data.loginStreak || 0)).catch(console.error);
  }, []);

  const fetchChallenges = async () => {
    try {
      const data = await challengesApi.list();
      setChallengeList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await challengesApi.create({ name: form.name, gameId: parseInt(form.gameId), endDate: form.endDate });
      setShowCreate(false);
      setForm({ name: "", gameId: "", endDate: "" });
      fetchChallenges();
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async (challengeId) => {
    try {
      await challengesApi.join(challengeId);
      fetchChallenges();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheck = async (challengeId) => {
    try {
      const updated = await challengesApi.check(challengeId);
      fetchChallenges();
      setSelectedChallenge(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const isActive = (c) => new Date(c.endDate) > new Date();
  const isCreator = (c) => c.creatorId === JSON.parse(atob(localStorage.getItem("token").split(".")[1])).userId;

  if (loading) return <div className="page"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Challenges</h1>
          <p className="page-subtitle">Compete with friends</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> Create Challenge
        </button>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="card-header">
          <h2>Daily Challenges</h2>
          <span className="badge" style={{ backgroundColor: "var(--accent)" }}><Flame size={14} /> {loginStreak} day streak</span>
        </div>
        <div className="card-body">
          {dailyChallengesList.length === 0 ? (
            <p className="empty-text">No daily challenges for today yet. Play some games to generate them!</p>
          ) : (
            <div className="daily-challenges-list">
              {dailyChallengesList.map((dc) => (
                <div key={dc.id} className={`daily-challenge-item ${dc.completed ? "daily-challenge-done" : ""}`}>
                  <div className="daily-challenge-info">
                    <span className="daily-challenge-name">{dc.name}</span>
                    <span className="setting-desc">{dc.description}</span>
                  </div>
                  <div className="daily-challenge-right">
                    <div className="daily-challenge-progress-bar">
                      <div className="daily-challenge-progress-fill" style={{ width: `${Math.min(100, (dc.progress / dc.requirement) * 100)}%` }} />
                    </div>
                    <span className="daily-challenge-progress-text">{Math.min(dc.progress, dc.requirement)}/{dc.requirement}</span>
                    {dc.completed ? (
                      <span className="badge" style={{ backgroundColor: "#22c55e" }}>+{dc.xpReward} XP</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: "var(--text-muted)" }}>{dc.xpReward} XP</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner" />
      ) : challengeList.length === 0 ? (
        <div className="empty-state">
          <Trophy size={48} className="empty-icon" />
          <h2>No challenges yet</h2>
          <p>Create a challenge to compete with friends on playtime</p>
        </div>
      ) : (
        <div className="challenge-list">
          {challengeList.map((c) => (
            <div key={c.id} className={`challenge-card ${isActive(c) ? "challenge-active" : "challenge-expired"}`} onClick={() => setSelectedChallenge(c)}>
              <div className="challenge-card-header">
                <h3>{c.name}</h3>
                <span className={`challenge-status-badge ${isActive(c) ? "status-active" : "status-expired"}`}>
                  {isActive(c) ? "Active" : "Expired"}
                </span>
              </div>
              <div className="challenge-card-body">
                <span><Gamepad2 size={14} /> {c.game.name}</span>
                <span><Users size={14} /> {c.participants.length} participants</span>
                <span><Calendar size={14} /> Ends {new Date(c.endDate).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>Create Challenge</h2>
              <button className="btn-icon" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Challenge Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Weekend Marathon" />
              </div>
              <div className="form-group">
                <label>Game</label>
                <select value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })} required>
                  <option value="">Select a game</option>
                  {gameList.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Trophy size={16} /> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedChallenge && (
        <div className="modal-overlay" onClick={() => setSelectedChallenge(null)}>
          <div className="modal challenge-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h2>{selectedChallenge.name}</h2>
              <button className="btn-icon" onClick={() => setSelectedChallenge(null)}><X size={18} /></button>
            </div>
            <div className="challenge-detail-info">
              <p><Gamepad2 size={14} /> {selectedChallenge.game.name}</p>
              <p><Calendar size={14} /> {new Date(selectedChallenge.startDate).toLocaleDateString()} - {new Date(selectedChallenge.endDate).toLocaleDateString()}</p>
              <p>Created by {selectedChallenge.creator.displayName || selectedChallenge.creator.username}</p>
            </div>
            <h3>Participants ({selectedChallenge.participants.length})</h3>
            <div className="challenge-participants">
              {selectedChallenge.participants.map((p) => (
                <div key={p.id} className={`challenge-participant-row ${p.won ? "challenge-winner" : ""}`}>
                  <div className="challenge-participant-info">
                    <span className="challenge-participant-name">{p.user.displayName || p.user.username}</span>
                    {p.won && <span className="challenge-winner-badge">Winner</span>}
                  </div>
                  <span className="challenge-participant-playtime">
                    {Math.floor(p.playtime / 60)}h {p.playtime % 60}m
                  </span>
                </div>
              ))}
            </div>
            <div className="challenge-detail-actions">
              {!selectedChallenge.participants.some((p) => p.userId === JSON.parse(atob(localStorage.getItem("token").split(".")[1])).userId) && (
                <button className="btn btn-primary" onClick={() => { handleJoin(selectedChallenge.id); }}>Join Challenge</button>
              )}
              {isCreator(selectedChallenge) && (
                <button className="btn btn-secondary" onClick={() => { handleCheck(selectedChallenge.id); }}>Check Winner</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Challenges;
