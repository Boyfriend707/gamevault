import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { chats as chatsApi } from "../api";
import AvatarWithDecoration from "../components/AvatarWithDecoration";
import VIPBadge from "../components/VIPBadge";

function Chat({ user }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadConversations();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const last = messages[messages.length - 1];
      try {
        const newMsgs = await chatsApi.getMessages(convo.id, last?.id);
        if (newMsgs.length > 0) {
          setMessages((prev) => [...prev, ...newMsgs]);
        }
      } catch (err) { /* ignore */ }
    }, 3000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedConvo) return;
    try {
      const msg = await chatsApi.sendMessage(selectedConvo.id, input);
      setMessages((prev) => [...prev, msg]);
      setInput("");
      setConversations((prev) => prev.map((c) =>
        c.id === selectedConvo.id ? { ...c, lastMessage: msg, updatedAt: new Date().toISOString() } : c
      ));
    } catch (err) { console.error(err); }
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
                    <span className="chat-convo-preview">{convo.lastMessage?.content?.slice(0, 40) || "No messages yet"}</span>
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
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <p className="empty-text" style={{ textAlign: "center", padding: "2rem" }}>No messages yet. Say hi!</p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === user.id;
                    return (
                      <div key={msg.id} className={`chat-msg ${isMe ? "chat-msg-me" : "chat-msg-other"}`}>
                        {!isMe && <AvatarWithDecoration user={msg.user} size={28} />}
                        <div className="chat-msg-content">
                          <div className="chat-msg-bubble">{msg.content}</div>
                          <span className="chat-msg-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input" onSubmit={sendMessage}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
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
