import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, UserPlus, MessageCircle, Trophy, X } from "lucide-react";
import { notificationsApi } from "../api";

const ICONS = {
  friend_request: UserPlus,
  friend_accepted: UserPlus,
  goal_completed: Trophy,
  new_message: MessageCircle,
};

function NotificationsCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await notificationsApi.list();
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch (err) {
      /* ignore */
    }
  };

  const handleClick = async (n) => {
    if (!n.read) {
      await notificationsApi.markRead(n.id);
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const IconComponent = (n) => {
    const Comp = ICONS[n.type] || Bell;
    return <Comp size={16} />;
  };

  return (
    <div className="notif-wrapper" ref={ref}>
      <button className="notif-bell" onClick={() => setOpen(!open)}>
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {unread > 0 && (
              <button className="btn-link" onClick={handleMarkAllRead}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="notif-list">
            {notifications.length === 0 && <div className="notif-empty">No notifications yet</div>}
            {notifications.map((n) => (
              <div key={n.id} className={`notif-item ${n.read ? "" : "notif-unread"}`} onClick={() => handleClick(n)}>
                <div className="notif-icon">{IconComponent(n)}</div>
                <div className="notif-content">
                  <div className="notif-title">{n.title}</div>
                  {n.body && <div className="notif-body">{n.body}</div>}
                  <div className="notif-time">{formatTime(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export { NotificationsCenter };
export default NotificationsCenter;
