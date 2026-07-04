# GameVault

A gaming dashboard desktop app for you and your friends. Track game collections, link Steam accounts, and see what your friends are playing.

## Project Structure

```
GameVault/
├── client/          # Electron + React (Vite) desktop app
├── server/          # Express + Prisma + SQLite backend
└── README.md
```

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- A Steam Web API key (free) — get one at https://steamcommunity.com/dev/apikey

### 1. Set up the server

```bash
cd server

# Edit .env and set your STEAM_API_KEY
# The defaults work for local development

# Push the database schema
npx prisma db push

# Start the dev server
npm run dev
```

Server runs on **http://localhost:3001**.

### 2. Set up the client

```bash
cd client
npm run dev
```

Client runs on **http://localhost:5173**.

### 3. Desktop app (optional, for development)

```bash
cd client
npm run electron:dev
```

## Deploying the Server (Katabump Free Tier)

Katabump offers free Node.js hosting (308 MB RAM, 716 MB storage) that must be renewed every 4 days.

### Step 1: Prepare the server files

```bash
cd server

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### Step 2: Create a ZIP archive

Create a ZIP of the `server/` folder including:
- `src/` (all source files)
- `prisma/` (schema + migrations)
- `package.json`
- `package-lock.json`
- `.env` (with your config)

**Important:** The `.env` file must include your `STEAM_API_KEY`, a `JWT_SECRET`, and `DATABASE_URL=file:./dev.db`.

### Step 3: Upload to Katabump

1. Go to https://dashboard.katabump.com and create a **Node.js** server
2. Upload the ZIP via the **Files** tab and unarchive it
3. Go to the **Startup** tab and set the entry point to `src/index.js`
4. Select Node.js version **20** or **22**
5. Go to **Console** and click **Start**

The server will run `npm start` (which runs `node src/index.js`). Your database will be stored in the SQLite file at `prisma/dev.db`.

### Step 4: Note your server URL

Katabump will assign a URL like `https://your-server.katabump.com`. You'll need this for the desktop app.

## Packaging the Client (.exe Installer)

### Prerequisites

- Windows machine (to build Windows installer)
- The server must be deployed somewhere accessible to your friends

### Step 1: Set the server URL

Edit `client/src/config.js` and change `API_BASE` to your deployed server URL:
```js
let base = "https://your-server.katabump.com/api";
```

### Step 2: Build the installer

```bash
cd client
npm run electron:build
```

The installer will be created in `client/release/`. It's a `.exe` file your friends can install.

### Step 3: Distribute

Share the `.exe` with friends. When they open GameVault, it will connect to your server automatically.

## How Updates Work

When you release a new version, here's the flow:

### Releasing a new client version

1. Make your code changes in the `client/` folder
2. Update the `version` field in `client/package.json` (e.g., `"1.1.0"`)
3. Build the new installer:
   ```bash
   cd client
   npm run electron:build
   ```
4. This creates `client/release/GameVault Setup X.X.X.exe` + `latest.yml`
5. Upload both files to your server's `updates/` folder:
   - `server/updates/GameVault-Setup-X.X.X.exe`
   - `server/updates/latest.yml`
6. Update `server/updates/version.json` with the new version number

### Releasing a new server version

1. Make your code changes in the `server/` folder
2. Create a new ZIP of the `server/` folder
3. On Katabump, upload the ZIP via the **Files** tab and unarchive it (overwrite existing files)
4. Go to **Console** and click **Restart**

### What users see

- When a friend launches the app, it checks the server for a newer version
- If one is found, a popup shows: "Update Available — vX.X.X"
- They can choose **Download Update** → progress bar shows download %
- Then **Install & Restart** → runs the installer and quits the app
- Or **Not Now** → they can update later from **Settings > Updates > Check for Updates**
- If they snooze, that version won't prompt again (until a newer one comes out)

## How It Works

- **Server** — Express API + SQLite database. Stores users, games, friendships, Steam links.
- **Client** — React app in Electron. Talks to the server via HTTP.
- **Auth** — Register/login with username + password. Passwords hashed with bcrypt, sessions via JWT.
- **Friends** — Search by exact username, send/accept/decline requests.
- **Games** — Add/edit/remove with platform, status (playing/completed/backlog/dropped), notes.
- **Steam** — Link via Steam OpenID (opens a child window in the desktop app). Sync owned games and online status.
- **Settings** — Change password, toggle light/dark theme, manage friends.

### Steam Linking (Desktop App)

In the Electron desktop app, Steam authentication opens inside the app (not your browser). A child window handles the Steam login flow and closes automatically when done.

## Configuration

### Server (`server/.env`)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `JWT_SECRET` | Secret key for JWT signing | Change for production |
| `STEAM_API_KEY` | Your Steam Web API key | Required for Steam features |
| `PORT` | Server port (Katabump sets this) | `3001` |

## Security Notes

- Passwords are hashed with bcrypt (never stored in plain text)
- Steam API key is server-side only — never exposed to the client
- JWT tokens expire after 7 days
- Friend data is only visible to accepted friends
- Input validation is performed on the server
