# Coding Agent Prompt: Gaming Dashboard Desktop App

Copy everything below this line into your coding agent (e.g. Claude Code).

---

## Project Overview

Build a **desktop app** called a "Gaming Dashboard" for me and a small group of friends. It's a fun/personal project (not commercial), so prioritize simplicity, working features, and clean code over enterprise-grade complexity.

Core idea: each user has an account, can add friends by username, link their Steam account, and see a dashboard of their game collection and (later) stats.

## Important Architecture Note

Because users need to send friend requests and view each other's profiles **across different computers**, this cannot be a purely local/offline desktop app. It needs:

1. **A backend server + shared database** (small, self-hostable) that stores users, friendships, game collections, and settings.
2. **A desktop client** (the app we each run) that talks to that backend over the internet/LAN.

Please set the project up as two parts in one repo (or clearly separated folders): `client/` and `server/`.

## Recommended Tech Stack (feel free to confirm/adjust, but explain if you deviate)

- **Desktop client:** Electron + React (widely documented, huge community, easy for a beginner to extend)
- **Backend:** Node.js + Express
- **Database:** SQLite to start (via Prisma ORM) — easy to run locally, easy to swap to Postgres later if this grows
- **Auth:** Username + password, hashed with bcrypt, sessions via JWT
- **Steam integration:** Steam Web API (needs a free Steam Web API key) + Steam OpenID for linking accounts

## Phase 1 Features (build these first)

### 1. Authentication
- Register with username + password
- Login/logout
- Passwords hashed (bcrypt), never stored in plain text
- Basic session handling (JWT stored securely in the client)

### 2. Friends System
- Search for a user by exact username
- Send a friend request
- Accept/decline incoming friend requests
- View list of current friends
- View a friend's profile (their game collection, Steam status if shared — respect basic privacy, don't expose data to non-friends)

### 3. Dashboard (home screen)
- Overview of: your game collection, your Steam status (online/offline/in-game), quick friend list with online status
- Keep it simple and clean for v1 — a few cards/widgets is enough

### 4. Game Collections
- Add a game manually (name, platform, notes, maybe cover art later)
- Edit/remove games from your collection
- View your collection in a list or grid

### 5. Steam Integration
- Let a user link their Steam account (Steam OpenID login flow)
- Once linked, pull in:
  - Their owned games (Steam Web API `GetOwnedGames`)
  - Their current status — online/offline/in-game (Steam Web API `GetPlayerSummaries`)
- Add a "Sync with Steam" button that refreshes this data on demand
- Store the Steam API key server-side only, never expose it to the client

### 6. Settings
- Basic settings page: change password, unlink Steam account, maybe a theme toggle (light/dark)
- Keep this minimal for now — just scaffold it so it's easy to add more settings later

## Visual Style / UI Reference

I have a rough mockup in mind for the look and feel (called "GameVault" in the mockup — feel free to use that as the app name unless I say otherwise). Match this general style:

- **Top nav bar:** app logo/name on the left (icon + bold text), then nav links as pill/tab buttons: Collection, Steam, Settings. The active tab is a solid black pill with white text; inactive tabs are plain gray text with an icon.
- **Page header:** large bold page title (e.g. "Collection") with a smaller gray subtitle underneath (e.g. "Your game collection"), and a primary action button top-right (black background, white text, "+" icon, e.g. "+ Add Game").
- **Stat cards row:** 4 small cards side by side, each with an icon in a rounded square, a large bold number, and a gray label underneath (e.g. Total Games, Playing, Completed, Backlog). Clean white cards with light borders/shadow.
- **Search + filter row:** a search input with a magnifying glass icon and placeholder text ("Search games..."), plus a dropdown filter (e.g. "All") to the right.
- **Empty state:** centered "+" icon, bold "No games yet" heading, gray helper text, and a black "+ Add Your First Game" button.
- **Overall aesthetic:** minimal, black/white/gray palette with small accent colors per stat icon (green, blue, orange, etc.), rounded corners, generous whitespace, sans-serif font. Modern SaaS-dashboard look.

Apply this same visual language (nav bar, cards, empty states, buttons) consistently across the Dashboard, Collection, Steam, and Settings pages for a cohesive design system — don't just style the Collection page.

## Phase 2 (mention in code comments / README as "planned," don't build yet unless I ask)
- Game stats tracker (playtime trends, achievements, comparisons between friends)
- Possibly game cover art / richer collection view
- Notifications for friend requests / friend activity

## What I need from you as the coding agent

1. Ask me clarifying questions if anything above is ambiguous before writing large amounts of code.
2. Scaffold the project structure first (client + server folders, package.json files, basic README) and show me before building out every feature.
3. Set up the database schema (Users, FriendRequests/Friends, GameCollections, SteamLinks, Settings) and explain it briefly.
4. Build features in the order listed above (Auth → Friends → Dashboard → Game Collections → Steam Integration → Settings).
5. Write a README explaining how to run both the server and the client locally, including where I need to put my own Steam Web API key.
6. Keep the code beginner-friendly and well-commented, since I'll be maintaining this myself.
7. Flag any security concerns (e.g. exposed keys, unhashed passwords) proactively as you go.

## Notes
- This is a personal/hobby project for a small friend group, not a public product — no need for enterprise scaling, but do follow basic security best practices (hashed passwords, no exposed API keys, input validation on the server).
- More features will be requested later; keep the code modular so it's easy to extend.
