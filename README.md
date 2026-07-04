# GameVault

A gaming dashboard desktop app for you and your friends. Track game collections, link Steam accounts, log playtime, earn XP, complete goals and challenges, share screenshots, and see what your friends are playing.

## Stack

- **Client** — Electron + React (Vite) desktop app
- **Server** — Express + Prisma + PostgreSQL (Neon)
- **Auth** — bcrypt + JWT
- **Uploads** — Cloudinary (avatars, banners, covers, screenshots, decorations)
- **Hosting** — Render (server) + Neon (database) + Cloudinary (media)
- **CI/CD** — GitHub → Render auto-deploy + `deploy.ps1` for .exe releases

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- A Steam Web API key (free) — https://steamcommunity.com/dev/apikey
- Cloudinary account (free) — https://cloudinary.com
- Neon PostgreSQL database (free) — https://neon.tech

### 1. Set up the server

```bash
cd server

# Copy .env.example or create .env with:
# DATABASE_URL=postgresql://...
# JWT_SECRET=your-secret
# STEAM_API_KEY=your-key
# CLOUDINARY_CLOUD_NAME=your-cloud
# CLOUDINARY_API_KEY=your-key
# CLOUDINARY_API_SECRET=your-secret

npx prisma db push
npm run dev
```

Server runs on **http://localhost:3001**.

### 2. Set up the client

```bash
cd client
npm run dev
```

Client runs on **http://localhost:5173**.

### 3. Desktop app (development)

```bash
cd client
npm run electron:dev
```

## Deploying

### Server (Render + Neon + Cloudinary)

1. Create a Neon database, copy the connection string
2. Create a Cloudinary account, note the credentials
3. On Render, create a **New Web Service** connected to your GitHub repo
4. Set the build command:
   ```
   cd client && npm install --include=dev && npm run build && cd ../server && npm install
   ```
5. Set the start command:
   ```
   cd server && npx prisma db push && node src/index.js
   ```
6. Add environment variables (Render Dashboard > Environment):
   - `DATABASE_URL` — your Neon connection string
   - `JWT_SECRET` — a random string
   - `STEAM_API_KEY` — your Steam API key
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ADMIN_PASSWORD` — for the admin panel
7. Deploy — Render builds and runs the server, which also serves the built React app

### Desktop App (.exe)

The server URL is hardcoded in `client/electron/preload.cjs`. Build the installer:

```bash
cd client
npm run electron:build
```

Output: `client/release/GameVault Setup X.X.X.exe`

### Publishing a Release

Use the included `deploy.ps1` script:

```powershell
# Full release (bumps patch version, builds frontend + .exe, pushes to GitHub)
./deploy.ps1 -Notes "What changed"

# Web-only (skip .exe build)
./deploy.ps1 -SkipExe -Notes "What changed"
```

This auto-increments the patch version, updates `package.json` and `version.json`, builds everything, commits, and pushes. The .exe is copied to `server/updates/` so the auto-update system picks it up.

## Auto-Update

On startup, the app pings `/api/update` on the server. If a newer version is found, a popup offers **Install & Restart** or **Not Now**. The installer is downloaded from `https://your-server.onrender.com/updates/GameVault Setup X.X.X.exe`.

To bump versions without building a new .exe, just update `server/updates/version.json`.

## Features

- **Game Collection** — add/edit/delete games with platform, status, notes, cover art, star rating
- **Steam Sync** — link your Steam account, import your library and online status
- **Playtime Tracking** — auto-detects when a launched .exe exits and logs elapsed time
- **Friends** — search by username, send/accept/decline requests, browse friend libraries
- **Levels & XP** — earn XP for adding games (+25), playtime (+1/min), goals (+100), ratings (+20), tags (+10)
- **Goals** — 13 auto-completing goals (first game, rate 5 games, add friends, etc.) with theme unlocks
- **Challenges** — create competitions with end dates, join friends, pick winners
- **Achievements / Milestones** — add custom milestones per game, mark complete, show on profile
- **Screenshots** — upload per-game screenshots with captions, view in gallery/carousel
- **Server Status** — track game server hosts/ports with online/offline ping
- **Playtime Leaderboard** — top 5 friends by total playtime on the dashboard
- **Game Randomizer** — one-click random game picker
- **Layout Customization** — grid/list toggle, sort by name/playtime/rating/recent
- **Chat** — real-time (polling) messaging with friends
- **Notifications** — bell icon with unread count for friend requests, goal completions
- **Profile** — custom display name, bio, banner, avatar with decorations, stat cards, pinned games, milestones
- **Appearance** — 11 themes, custom accent color picker, animated gradient/uploaded backgrounds
- **Admin Panel** — tap version 5x → enter `ADMIN_PASSWORD` → manage users (roles, XP), delete games, manage decorations
- **Decorations** — GIF overlays for avatars, uploaded via admin panel
- **Auto-Update** — checks server for new .exe versions on launch

## Configuration

### Server (`server/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT signing |
| `STEAM_API_KEY` | Required for Steam features |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ADMIN_PASSWORD` | Admin panel login password |
| `PORT` | Server port (Render sets this) |

## Security

- Passwords hashed with bcrypt
- Steam API key is server-side only
- JWT tokens expire after 7 days
- Friend data visible only to accepted friends
- Input validation on the server
