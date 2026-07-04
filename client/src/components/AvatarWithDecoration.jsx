import { resolveAssetUrl } from "../config";

function AvatarWithDecoration({ user, size = 32, className = "" }) {
  const avatarUrl = resolveAssetUrl(user?.avatarUrl);
  const decorationUrl = resolveAssetUrl(user?.decorationUrl);

  return (
    <div className={`avatar-deco-wrapper ${className}`} style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="avatar-deco-img" style={{ width: size, height: size }} />
      ) : (
        <div className="avatar-deco-placeholder" style={{ width: size, height: size, fontSize: size * 0.4 }}>
          {user?.username?.[0]?.toUpperCase() || "?"}
        </div>
      )}
      {decorationUrl && (
        <img src={decorationUrl} alt="" className="avatar-deco-overlay" />
      )}
    </div>
  );
}

export default AvatarWithDecoration;
