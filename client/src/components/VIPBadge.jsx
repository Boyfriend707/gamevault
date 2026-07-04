import { Crown } from "lucide-react";

export default function VIPBadge({ size = 16 }) {
  return (
    <span className="vip-badge" title="VIP" style={{ display: "inline-flex", alignItems: "center", marginLeft: 4 }}>
      <Crown size={size} fill="currentColor" />
    </span>
  );
}
