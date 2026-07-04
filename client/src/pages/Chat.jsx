import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Send, ArrowLeft, Image, Smile, Edit2, Trash2, Reply, Search, X } from "lucide-react";
import { chats as chatsApi } from "../api";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import VIPBadge from "../components/VIPBadge";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Chat({ user }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showEmoji, setShowEmoji] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [typingText, setTypingText] = useState("");
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const typingRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConvo || !selectedConvo.typing) { setTypingText(""); return; }
    try {
      const t = JSON.parse(selectedConvo.typing);
      if (t.userId !== user.id && Date.now() - t.timestamp < 4000) {
        const other = selectedConvo.otherUser;
        setTypingText(`${other?.displayName || other?.username} is typing...`);
      } else {
        setTypingText("");
      }
    } catch { setTypingText(""); }
  }, [selectedConvo, messages]);

  const loadConversations = async () => {
    try {
      const convos = await chatsApi.list();
      setConversations(convos);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const selectConversation = async (convo) => {
    setSelectedConvo(convo);
    const msgs = await chatsApi.getMessages(convo.id);
    setMessages(msgs);
    setReplyTo(null);
    setEditingId(null);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const last = messages[messages.length - 1];
      try {
        const [newMsgs, convos] = await Promise.all([
          chatsApi.getMessages(convo.id, last?.id),
          chatsApi.list(),
        ]);
        if (newMsgs.length > 0) {
          setMessages((prev) => [...prev, ...newMsgs]);
        }
        setConversations(convos);
        const updated = convos.find((c) => c.id === convo.id);
        if (updated) setSelectedConvo((prev) => ({ ...prev, typing: updated.typing }));
      } catch (err) { /* ignore */ }
    }, 3000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedConvo) return;
    try {
      const msg = await chatsApi.sendMessage(selectedConvo.id, input, replyTo?.id);
      setMessages((prev) => [...prev, msg]);
      setInput("");
      setReplyTo(null);
      setConversations((prev) => prev.map((c) =>
        c.id === selectedConvo.id ? { ...c, lastMessage: msg } : c
      ));
    } catch (err) { console.error(err); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvo) return;
    try {
      const msg = await chatsApi.uploadImage(selectedConvo.id, file);
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) => prev.map((c) =>
        c.id === selectedConvo.id ? { ...c, lastMessage: msg } : c
      ));
    } catch (err) { console.error(err); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEdit = async (messageId) => {
    if (!editText.trim()) return;
    try {
      const updated = await chatsApi.editMessage(messageId, editText);
      setMessages((prev) => prev.map((m) => m.id === messageId ? updated : m));
      setEditingId(null);
      setEditText("");
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (messageId) => {
    try {
      await chatsApi.deleteMessage(messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: "", imageUrl: null } : m));
    } catch (err) { console.error(err); }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const result = await chatsApi.toggleReaction(messageId, emoji);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions: result.reactions } : m));
    } catch (err) { console.error(err); }
    setShowEmoji(null);
  };

  const handleTyping = async () => {
    if (!selectedConvo) return;
    try {
      await chatsApi.setTyping(selectedConvo.id);
    } catch (err) { /* ignore */ }
  };

  const startChat = async (friendId) => {
    try {
      const convo = await chatsApi.createOrGet(friendId);
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === convo.id);
        return exists ? prev : [convo, ...prev];
      });
      selectConversation(convo);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || !selectedConvo) { setSearchResults([]); return; }
    try {
      const results = await chatsApi.search(selectedConvo.id, q);
      setSearchResults(results);
    } catch (err) { console.error(err); }
  };

  const jumpToMessage = (msgId) => {
    document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const getReactions = (msg) => {
    try { return msg.reactions ? JSON.parse(msg.reactions) : {}; } catch { return {}; }
  };

  const canModify = (msg) => {
    return msg.userId === user.id && !msg.deletedAt && (Date.now() - new Date(msg.createdAt).getTime() < 5 * 60 * 1000);
  };

  if (loading) {
    return <div className="page"><div className="loading-spinner" /></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Chat with your friends</p>
        </div>
      </div>

      <div className="chat-layout">
        <div className="chat-sidebar">
          <div className="chat-convo-list">
            {conversations.length === 0 ? (
              <p className="empty-text">No conversations yet. Go to a friend's profile to start chatting!</p>
            ) : (
              conversations.map((convo) => (
                <div key={convo.id}
                  className={`chat-convo-item ${selectedConvo?.id === convo.id ? "chat-convo-active" : ""}`}
                  onClick={() => selectConversation(convo)}>
                  <AvatarWithDecoration user={convo.otherUser || {}} size={36} />
                  <div className="chat-convo-info">
                    <span className="chat-convo-name">{convo.otherUser?.displayName || convo.otherUser?.username || "Unknown"}{(convo.otherUser?.role === "vip" || convo.otherUser?.role === "admin") && <VIPBadge size={12} />}</span>
                    <span className="chat-convo-preview">{convo.lastMessage?.imageUrl ? "[Image]" : (convo.lastMessage?.content?.slice(0, 40) || "No messages yet")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-main">
          {!selectedConvo ? (
            <div className="chat-empty">
              <MessageSquare size={48} />
              <p>Select a conversation or start a new one</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button className="btn-icon chat-mobile-back" onClick={() => setSelectedConvo(null)}>
                  <ArrowLeft size={18} />
                </button>
                <AvatarWithDecoration user={selectedConvo.otherUser || {}} size={32} />
                <span className="chat-header-name">{selectedConvo.otherUser?.displayName || selectedConvo.otherUser?.username}{(selectedConvo.otherUser?.role === "vip" || selectedConvo.otherUser?.role === "admin") && <VIPBadge size={14} />}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                  <button className="btn-icon" onClick={() => setShowSearch(!showSearch)} title="Search messages">
                    <Search size={16} />
                  </button>
                </div>
              </div>

              {showSearch && (
                <div className="chat-search-bar">
                  <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search messages..." className="chat-input-field" autoFocus />
                  <button className="btn-icon" onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
                    <X size={16} />
                  </button>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="chat-search-results">
                  {searchResults.slice(0, 10).map((r) => (
                    <div key={r.id} className="chat-search-item" onClick={() => jumpToMessage(r.id)}>
                      <span className="chat-search-item-name">{r.user.displayName || r.user.username}</span>
                      <span className="chat-search-item-text">{r.content?.slice(0, 60)}</span>
                      <span className="chat-msg-time">{formatTime(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <p className="empty-text" style={{ textAlign: "center", padding: "2rem" }}>No messages yet. Say hi!</p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === user.id;
                    const deleted = msg.deletedAt;
                    const reactions = getReactions(msg);
                    const reactedByMe = (emoji) => reactions[emoji]?.includes(user.id);

                    return (
                      <div key={msg.id} id={`msg-${msg.id}`} className={`chat-msg ${isMe ? "chat-msg-me" : "chat-msg-other"} ${deleted ? "chat-msg-deleted" : ""}`}>
                        {!isMe && !deleted && <AvatarWithDecoration user={msg.user} size={28} />}
                        <div className="chat-msg-content">
                          {msg.replyTo && !deleted && (
                            <div className="chat-msg-reply" onClick={() => jumpToMessage(msg.replyTo.id)}>
                              <span className="chat-msg-reply-name">{msg.replyTo.user?.displayName || msg.replyTo.user?.username || "Unknown"}</span>
                              <span className="chat-msg-reply-text">{msg.replyTo.content?.slice(0, 50) || (msg.replyTo.imageUrl ? "[Image]" : "")}</span>
                            </div>
                          )}
                          <div className="chat-msg-bubble" onMouseEnter={() => !deleted && setShowEmoji(msg.id)} onMouseLeave={() => setShowEmoji(null)}>
                            {deleted ? (
                              <em style={{ opacity: 0.5, fontSize: "0.85em" }}>Message deleted</em>
                            ) : editingId === msg.id ? (
                              <div className="chat-edit-form">
                                <input type="text" value={editText} onChange={(e) => setEditText(e.target.value)}
                                  className="chat-input-field" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleEdit(msg.id); if (e.key === "Escape") { setEditingId(null); setEditText(""); } }} />
                                <div className="chat-edit-actions">
                                  <button className="btn btn-sm btn-primary" onClick={() => handleEdit(msg.id)}>Save</button>
                                  <button className="btn btn-sm" onClick={() => { setEditingId(null); setEditText(""); }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {msg.imageUrl && (
                                  <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={msg.imageUrl} alt="Shared image" className="chat-image" />
                                  </a>
                                )}
                                {msg.content && <span>{msg.content}</span>}
                                {msg.editedAt && <span className="chat-msg-edited"> (edited)</span>}
                              </>
                            )}

                            {!deleted && showEmoji === msg.id && (
                              <div className="chat-emoji-picker">
                                {EMOJI_LIST.map((emo) => (
                                  <button key={emo} className={`chat-emoji-btn ${reactedByMe(emo) ? "chat-emoji-active" : ""}`}
                                    onClick={() => handleReaction(msg.id, emo)}>
                                    {emo}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {!deleted && Object.keys(reactions).length > 0 && (
                            <div className="chat-msg-reactions">
                              {Object.entries(reactions).map(([emo, userIds]) =>
                                userIds.length > 0 && (
                                  <button key={emo} className={`chat-reaction-btn ${userIds.includes(user.id) ? "chat-reaction-active" : ""}`}
                                    onClick={() => handleReaction(msg.id, emo)}>
                                    {emo} {userIds.length}
                                  </button>
                                )
                              )}
                            </div>
                          )}

                          <div className="chat-msg-footer">
                            <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                            {isMe && !deleted && canModify(msg) && (
                              <span className="chat-msg-actions">
                                <button className="btn-icon" onClick={() => { setEditingId(msg.id); setEditText(msg.content); setReplyTo(null); }} title="Edit">
                                  <Edit2 size={12} />
                                </button>
                                <button className="btn-icon" onClick={() => handleDelete(msg.id)} title="Delete">
                                  <Trash2 size={12} />
                                </button>
                              </span>
                            )}
                            {!deleted && (
                              <button className="btn-icon" onClick={() => { setReplyTo(msg); setInput(""); }} title="Reply">
                                <Reply size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {typingText && <div className="chat-typing"><span>{typingText}</span></div>}
                <div ref={messagesEndRef} />
              </div>

              {replyTo && (
                <div className="chat-reply-preview">
                  <div className="chat-reply-preview-info">
                    <span className="chat-reply-preview-name">Replying to {replyTo.user?.displayName || replyTo.user?.username || user.displayName || user.username}</span>
                    <span className="chat-reply-preview-text">{replyTo.content?.slice(0, 60) || (replyTo.imageUrl ? "[Image]" : "")}</span>
                  </div>
                  <button className="btn-icon" onClick={() => setReplyTo(null)}><X size={14} /></button>
                </div>
              )}

              <form className="chat-input" onSubmit={sendMessage}>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleImageUpload} />
                <button type="button" className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Send image">
                  <Image size={18} />
                </button>
                <input type="text" value={input} onChange={(e) => { setInput(e.target.value); handleTyping(); }}
                  placeholder="Type a message..." className="chat-input-field" />
                <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Chat;