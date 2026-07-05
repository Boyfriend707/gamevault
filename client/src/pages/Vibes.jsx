import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, StickyNote, Image } from "lucide-react";
import { vibesApi, chats as chatsApi } from "../api";
import AvatarWithDecoration from "../components/AvatarWithDecoration";

const COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff", "#fed7aa", "#fbcfe8", "#cbd5e1"];

function Vibes({ user }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [color, setColor] = useState("#fef08a");

  useEffect(() => {
    vibesApi.list().then(setNotes).catch(console.error);
  }, []);

  const addNote = async () => {
    if (!content.trim()) return;
    try {
      const note = await vibesApi.create({ content, color });
      setNotes((prev) => [note, ...prev]);
      setContent("");
      setColor("#fef08a");
      setShowForm(false);
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (id) => {
    try {
      await vibesApi.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vibes Board</h1>
          <p className="page-subtitle">Sticky notes for your friends</p>
        </div>
      </div>

      <div className="vibes-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> New Note
        </button>
      </div>

      {showForm && (
        <div className="vibes-form card">
          <div className="card-body">
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              className="form-textarea" rows={3} placeholder="Write something..." maxLength={200} />
            <div className="vibes-color-picker">
              {COLORS.map((c) => (
                <div key={c} className={`vibes-color-swatch ${c === color ? "vibes-color-active" : ""}`}
                  style={{ backgroundColor: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="vibes-form-actions">
              <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!content.trim()}>
                <StickyNote size={14} /> Post
              </button>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="vibes-grid">
        {notes.length === 0 ? (
          <p className="empty-text">No vibes yet. Post the first note!</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="vibe-note" style={{ backgroundColor: note.color || "#fef08a" }}>
              {(note.authorId === user.id || user.role === "admin") && (
                <button className="vibe-note-delete" onClick={() => deleteNote(note.id)}>
                  <X size={12} />
                </button>
              )}
              <div className="vibe-note-author" onClick={() => navigate(`/profile/${note.authorId}`)}>
                <AvatarWithDecoration user={note.author} size={20} />
                <span>{note.author.displayName || note.author.username}</span>
              </div>
              {note.imageUrl && <img src={note.imageUrl} alt="" className="vibe-note-image" />}
              <p className="vibe-note-content">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Vibes;
