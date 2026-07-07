import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Gamepad2,
  Cloud,
  Palette,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  Trophy,
  StickyNote,
  Menu,
  X,
} from "lucide-react";
import { Zap } from "lucide-react";
import AvatarWithDecoration from "./AvatarWithDecoration";
import VIPBadge from "./VIPBadge";
import NotificationsCenter from "./NotificationsCenter";

function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/collection", label: "Collection", icon: Gamepad2 },
    { to: "/steam", label: "Steam", icon: Cloud },
    { to: "/challenges", label: "Challenges", icon: Trophy },
    { to: "/appearance", label: "Appearance", icon: Palette },
    { to: "/chat", label: "Chat", icon: MessageSquare },
    { to: "/vibes", label: "Vibes", icon: StickyNote },
    { to: "/settings", icon: SettingsIcon },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate("/")}>
        <Gamepad2 size={24} className="brand-icon" />
        <span className="brand-text">GameVault</span>
      </div>

      <button className="navbar-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className={`navbar-links${mobileMenuOpen ? " navbar-links-open" : ""}`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
            onClick={() => setMobileMenuOpen(false)}
          >
            <link.icon size={18} />
            {link.label && <span>{link.label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="navbar-right">
        <NotificationsCenter />
        <div className="navbar-profile" onClick={() => navigate(`/profile/${user.id}`)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <AvatarWithDecoration user={user} size={32} />
          <span className="navbar-username">{user.displayName || user.username}{(user.role === "vip" || user.role === "admin") && <VIPBadge size={14} />}</span>
          {user.xp !== undefined && <span className="navbar-level">Lv.{Math.floor(Math.pow((user.xp || 0) / 100, 0.6))}</span>}
        </div>
        <button className="btn-icon" onClick={onLogout} title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
