# GameVault — Feature Build Specs

Stack context for the agent: React + Vite + React Router + Lucide icons, Electron wrapper, Express + Prisma + PostgreSQL (Neon), JWT + bcrypt auth, Cloudinary for all media, Render free tier (polling only, no WebSocket, no server disk), `role` field (admin/vip/user) + `ADMIN_PASSWORD` env var for admin panel, CSS custom properties + `data-theme` for theming.

Build these roughly top-to-bottom — earlier items are lower-dependency/self-contained; later ones lean on existing badge/XP/status systems.

---

## 1. Chat Polls

**What it does:** A new chat message type where a user posts a question with 2–6 options; friends tap to vote, results shown as live-ish bars, refreshed on the existing chat polling interval.

**Scope:** Small

**Data model:**
```
ChatPoll {
  id
  messageId (FK -> ChatMessage, 1:1)
  question       String
  options        Json  // [{ id, text }]
  allowMultiple  Boolean default false
  closesAt       DateTime? (optional expiry)
}
PollVote {
  id
  pollId (FK -> ChatPoll)
  userId (FK -> User)
  optionId       String
  createdAt
  @@unique([pollId, userId, optionId]) // or [pollId, userId] if single-vote only
}
```

**API:**
- `POST /api/chat/:chatId/polls` — create poll (piggybacks on existing send-message endpoint or a variant)
- `POST /api/polls/:pollId/vote` — cast/change vote
- `GET /api/polls/:pollId` — current tally (or bundle tally into the existing message-fetch payload)

**Frontend:** New message renderer branch alongside text/image messages. Bar-chart-style option list, highlight the option the current user picked, disable re-voting unless `allowMultiple`.

**Integration notes:** Reuses existing chat message table/pagination — treat `ChatPoll` as an extension table off `ChatMessage` (similar pattern to how images/replies likely attach). No new polling loop needed; ride the existing chat refresh interval.

---

## 2. Custom Server Badges

**What it does:** Admins create one-off badge definitions (icon/image, name, description) via the admin panel and manually award them to specific users. Purely cosmetic, shows on profile alongside existing badges.

**Scope:** Small

**Data model:**
```
Badge {
  id
  name          String
  description   String?
  iconUrl       String   // Cloudinary
  createdById   FK -> User (admin)
  createdAt
  isSystemBadge Boolean default false // distinguishes from auto-earned badges if those exist separately
}
UserBadge {
  id
  userId (FK -> User)
  badgeId (FK -> Badge)
  awardedById (FK -> User, admin)
  awardedAt
  note          String?  // optional "why" shown on hover
  @@unique([userId, badgeId])
}
```

**API:**
- `POST /api/admin/badges` — create badge definition (admin only, gate on `role === 'admin'`)
- `GET /api/admin/badges` — list all badge definitions
- `POST /api/admin/badges/:badgeId/award` — award to a userId
- `DELETE /api/admin/badges/:badgeId/award/:userId` — revoke
- `GET /api/users/:userId/badges` — likely already exists if badges are shown on profile; extend to include these

**Frontend:** Admin panel — new "Badges" tab: create form (name, description, icon upload to Cloudinary), user list with award/revoke action. Profile page: no changes needed if it already renders a generic badge list — just needs these mixed in.

**Integration notes:** If an auto-earned badge system already exists, keep `Badge` as one shared table with an `isSystemBadge` flag so profile rendering logic doesn't need two separate branches.

---

## 3. Report / Flag Message

**What it does:** Users can flag a chat message (text or image) for review; flagged items go into a lightweight admin review queue where an admin can dismiss or delete + optionally warn/mute the sender.

**Scope:** Small–Medium

**Data model:**
```
MessageReport {
  id
  messageId (FK -> ChatMessage)
  reporterId (FK -> User)
  reason        String?   // free text or enum
  status        Enum('pending','dismissed','actioned') default 'pending'
  createdAt
  resolvedById  FK -> User? (admin)
  resolvedAt    DateTime?
}
```

**API:**
- `POST /api/chat/messages/:messageId/report` — create report (any authenticated user, rate-limit to prevent spam — e.g. one report per user per message)
- `GET /api/admin/reports?status=pending` — queue for admin panel
- `POST /api/admin/reports/:reportId/resolve` — body: `{ action: 'dismiss' | 'delete_message' | 'delete_and_warn' }`

**Frontend:**
- Chat: small flag icon in the message hover/context menu (next to existing edit/delete/react icons) → confirm modal with optional reason.
- Admin panel: new "Reports" tab, queue list showing message preview, reporter, reason, timestamp, action buttons.

**Integration notes:** Reuses your existing chat message context-menu pattern (you already have edit/delete/react there) and the existing admin-panel shell/role gating. If you build **Custom Server Badges** admin tab first, copy its admin-panel layout conventions for consistency.

---

## 4. Electron / Desktop-Specific Bundle

Three related features that all build on the existing `.exe` process-detection logic used for playtime tracking. Recommend building in this order: Rich Presence → Auto-Launch → Global Hotkey Overlay (each is progressively more involved).

### 4a. Rich Presence (Tray / Window Title)
**What it does:** Shows the currently-detected running game + session playtime in the system tray tooltip and/or Electron window title bar.
**Scope:** Small
**Implementation:** Electron main process already has access to whatever loop detects running `.exe`s for playtime. Add:
- `tray.setToolTip(`Playing: ${gameName} — ${sessionMinutes}m`)` updated on the same interval as playtime polling.
- Optionally mirror into `mainWindow.setTitle(...)`.
No new IPC needed if detection already lives in main process; if detection lives in renderer, add a simple `ipcRenderer.send('update-presence', data)` → `ipcMain.on` handler.

### 4b. Auto-Launch / Focus on Game Start
**What it does:** When the process-detection loop notices a tracked game has just launched, bring GameVault to focus (or just fire an in-app toast) to mark session start explicitly rather than passively.
**Scope:** Medium
**Implementation:** Hook into the existing detection loop's "game started" event (you likely already have a start/stop transition there for playtime logging). On transition-to-started:
- If app is minimized/hidden: `mainWindow.show()` / `mainWindow.focus()` (make this a toggleable setting — some users won't want it stealing focus mid-game-launch).
- Always: push an in-app toast/notification "Session started: {game}".
Add a settings toggle: `autoFocusOnLaunch: boolean` (default off, since focus-stealing is intrusive).

### 4c. Global Hotkey Overlay
**What it does:** A configurable global hotkey (default e.g. `Ctrl+Shift+G`) pops a small always-on-top overlay window showing friend online status + chat unread count, without alt-tabbing out of a game.
**Scope:** Medium
**Implementation:**
- `globalShortcut.register('CommandOrControl+Shift+G', () => toggleOverlay())` in Electron main.
- Overlay = separate small `BrowserWindow` (`alwaysOnTop: true`, `frame: false`, `transparent: true`, small fixed size), loading a lightweight React route (e.g. `/overlay`) that fetches friend status + unread count from existing endpoints.
- Store hotkey preference in settings (Electron `Store`/local settings file or existing user-settings API) so it's user-configurable.
- Close on second press or on click-outside/blur.

**Integration notes for all three:** All reuse existing process-detection and friend-status/chat-unread endpoints — no new backend polling loops required, just new Electron main-process wiring and small new UI surfaces.

---

## 5. Lighter Social Textures Bundle

Four small, mostly-independent features that layer onto profile/status/chat systems you already have. Good "polish sprint" — can be built in any order or split up.

### 5a. Reactions on Profiles
**What it does:** Friends tap an emoji to leave a reaction on a user's profile/banner (guestbook-style, one tap, visible as a small reaction bar).
**Scope:** Small
**Data model:**
```
ProfileReaction {
  id
  profileUserId (FK -> User)  // whose profile
  reactorId (FK -> User)
  emoji         String
  createdAt
  @@unique([profileUserId, reactorId]) // one active reaction per visitor, upsert to change it
}
```
**API:** `POST /api/users/:userId/reactions` (upsert), `GET /api/users/:userId/reactions` (grouped counts + who reacted).
**Frontend:** Reuse your existing chat-reaction picker component if one exists; render a small pill row under the banner/avatar area.

### 5b. Birthday / Anniversary Reminders
**What it does:** Optional birthday field on profile; surfaces a small banner to friends on someone's GameVault account-creation anniversary or birthday.
**Scope:** Small
**Data model:** Add `birthday DateTime?` to `User`. Account-created anniversary uses existing `createdAt`.
**API:** Extend profile update endpoint to accept `birthday`. New lightweight `GET /api/dashboard/celebrations-today` checked on dashboard load (cheap query: `WHERE MONTH(birthday) = MONTH(NOW()) AND DAY(birthday) = DAY(NOW())`, same pattern for `createdAt`).
**Frontend:** Small celebratory banner component on dashboard, dismissible per day.
**Privacy note:** Make birthday field visibility opt-in (pairs naturally with **Granular Profile Visibility**, item 8 below — flag as `hideBirthday`).

### 5c. Custom Status Messages with Emoji
**What it does:** Extends the existing status field to support a short custom message + emoji (e.g. "🔥 grinding ranked"), shown next to the online indicator.
**Scope:** Small
**Data model:** If `status` is currently an enum, add `statusMessage String?` and `statusEmoji String?` to `User` (nullable, max length ~40 chars for message).
**API:** Extend existing status-update endpoint to accept the two new fields.
**Frontend:** Small text input + emoji picker in profile/settings; render inline next to existing online-indicator dot wherever that's currently shown (friend list, chat, profile header).

### 5d. Friend Group "Vibes" Board
**What it does:** A shared, persistent corkboard where friends pin short sticky-note-style messages or images — separate from chat, meant to be ambient/long-lived rather than scrolling away.
**Scope:** Medium
**Data model:**
```
VibeNote {
  id
  authorId (FK -> User)
  content       String?
  imageUrl      String?  // Cloudinary
  color         String   // sticky-note color, cosmetic
  positionX     Float?   // if freeform placement
  positionY     Float?
  createdAt
  pinnedUntil   DateTime? // optional auto-expiry
}
```
**API:** Standard CRUD — `GET/POST /api/vibes`, `DELETE /api/vibes/:id` (author or admin only).
**Frontend:** New route/tab, CSS-grid or absolutely-positioned sticky-note layout, simple color picker, upload via existing Cloudinary flow. Keep placement simple (grid, not drag-and-drop) for v1 to cut scope — freeform positioning can be a v2 add-on.

---

## 6. Loot Box Cosmetic Unlocks

**What it does:** XP-gated "crates" that users can open (via a level-up trigger or periodic free crate) to receive purely cosmetic rewards — profile frames, chat bubble colors, badge variants. No gameplay/stat effect, just flair tied into Appearance settings.

**Scope:** Medium–Large

**Data model:**
```
CosmeticItem {
  id
  type          Enum('profile_frame','chat_bubble_color','badge_variant','banner_effect', ...)
  name          String
  rarity        Enum('common','rare','epic','legendary')
  assetUrl      String?   // Cloudinary, if visual asset
  cssValue      String?   // if it's just a color/style token
}
LootCrate {
  id
  userId (FK -> User)
  source        Enum('level_up','daily_free','challenge_reward')
  opened        Boolean default false
  earnedAt
  openedAt      DateTime?
}
UserCosmetic {
  id
  userId (FK -> User)
  itemId (FK -> CosmeticItem)
  crateId (FK -> LootCrate?)
  equipped      Boolean default false
  obtainedAt
  @@unique([userId, itemId])
}
```

**API:**
- `POST /api/crates/:crateId/open` — server-side weighted random roll by rarity, insert `UserCosmetic`, return result
- `GET /api/crates` — user's unopened crates
- `GET /api/cosmetics` — user's owned cosmetics
- `POST /api/cosmetics/:itemId/equip` — toggle equipped state (unequip others of same `type` first)

**Trigger points:**
- On level-up (hook into existing XP/leveling system's level-up event) → grant a `LootCrate` with `source: 'level_up'`.
- Optional: daily free crate via existing Daily Challenge cron/job pattern.

**Frontend:**
- New "Crates" section (dashboard widget or dedicated page): unopened crate count, "open" animation (simple CSS reveal is fine — don't over-invest here).
- New "Cosmetics" tab in Appearance settings: grid of owned items grouped by type, equip/unequip toggle.
- Profile rendering: apply equipped `profile_frame`/`banner_effect`/`chat_bubble_color` wherever avatar/banner/chat bubbles currently render — this is the part that touches the most existing code, budget extra time here.

**Integration notes:** This is your biggest lift on this list because equipped cosmetics need to be read in multiple render paths (profile, chat, friend list). Recommend building the data model + crate-opening flow first, then rolling out equip-effects to one surface at a time (profile → chat → friend list) rather than all at once.

---

## 7. Collection Import/Export (non-Steam)

**What it does:** Manual CSV import for games owned on other launchers (Epic, GOG, itch.io, etc.) that Steam sync doesn't cover, plus a matching export.

**Scope:** Medium

**Data model:** No new tables needed if `Game` already has a `source` field; if not, add:
```
Game {
  ...existing fields
  source  Enum('steam','manual','epic','gog','itchio','other') default 'manual'
}
```

**API:**
- `POST /api/games/import-csv` — accepts uploaded CSV (title, playtime, tags, source columns), parses server-side (e.g. `csv-parse`), validates rows, bulk-inserts, returns success/error summary per row
- `GET /api/games/export-csv` — streams the user's collection as CSV

**Frontend:**
- Settings or Library page: "Import Collection" button → file picker → upload → show per-row results (imported / skipped duplicates / errors).
- "Export Collection" button → triggers download of `GET /api/games/export-csv` response.
- Provide a downloadable CSV template (title, playtime_hours, tags, source columns) so users format it correctly.

**Integration notes:** Reuses your existing game CRUD endpoints under the hood — import is really just "parse CSV → call the same create-game logic in a loop, with dedupe-by-title-per-user check." Keep column mapping fixed/simple for v1 (no flexible column-mapping UI) to control scope.

---

## 8. Granular Profile Visibility

**What it does:** Per-field privacy toggles (hide playtime, hide bio, hide friend list, hide birthday, etc.) instead of one all-or-nothing profile-privacy switch.

**Scope:** Small–Medium

**Data model:**
```
User {
  ...existing fields
  privacySettings  Json  default: {}
  // e.g. { hidePlaytime: false, hideBio: false, hideFriendList: false,
  //        hideBirthday: false, hideStatus: false, hideBadges: false }
}
```
(A JSON blob is simplest here rather than a column per field — cheap to extend later without migrations.)

**API:**
- `PATCH /api/users/me/privacy` — update the JSON blob
- Existing `GET /api/users/:userId/profile` — modify server-side to strip/omit fields based on the target user's `privacySettings` when the requester isn't the profile owner (and isn't admin, if admins should still see everything)

**Frontend:**
- Settings page: new "Privacy" section, one toggle per field, grouped logically (Stats: playtime, level; Personal: bio, birthday, status; Social: friend list, badges).
- Profile page: when rendering a friend's profile, sections should already just... not render if the API omitted the field — minimize frontend conditional logic by doing the filtering server-side.

**Integration notes:** Centralizing the filtering logic server-side (one function, e.g. `applyPrivacyFilter(profileData, viewerRole)`) means every other feature that surfaces profile data (Comparison Mode, Activity Feed, Reactions on Profiles, etc., if built later) can call the same helper instead of re-implementing privacy checks. Worth building this early if several social features are planned.

---

## 9. Achievement Hunter Badge Sync

**What it does:** Pulls Steam achievement completion percentage per game (via your existing Steam integration) and auto-awards a GameVault badge at completion milestones (e.g. 50%, 100%).

**Scope:** Medium

**Prerequisite check:** Confirm your current Steam sync already has access to a Steam Web API key/session capable of hitting `ISteamUserStats/GetPlayerAchievements` — if your existing Steam linking flow (Electron child BrowserWindow) only does OAuth-style login for library/online-status, you may need to extend it to also fetch achievement data per app ID, which requires the game to have Steam achievements enabled and the user's achievement data to be public.

**Data model:**
```
GameAchievementProgress {
  id
  userId (FK -> User)
  steamAppId    String
  totalAchievements    Int
  unlockedAchievements Int
  lastSyncedAt  DateTime
  @@unique([userId, steamAppId])
}
```
Reuse the `Badge`/`UserBadge` tables from **Custom Server Badges** (item 2) — mark these as `isSystemBadge: true` with a naming convention like `achv_50_<appId>` / `achv_100_<appId>`, or a more general "Achievement Hunter" tiered badge (Bronze/Silver/Gold across total games at each milestone) if per-game badges would be too noisy.

**API:**
- Extend existing Steam sync job/endpoint to also fetch achievement counts per game during sync
- Server-side check after each sync: if `unlockedAchievements / totalAchievements` crosses 50%/100% and the corresponding badge isn't yet awarded, insert `UserBadge`

**Frontend:**
- Per-game detail view: small progress bar "Achievements: 34/60 (56%)"
- Profile: new badges appear automatically wherever badges are already rendered (no new UI needed if item 2 is built first)

**Integration notes:** Build **Custom Server Badges** (item 2) before this one — this feature is essentially "an automated badge-awarding trigger" layered on that system rather than a standalone badge display mechanism. Also worth rate-limiting/batching Steam API calls per sync since achievement endpoints are called per-game, not per-user.

---

## Suggested Build Order Summary

1. Custom Server Badges *(foundation for #9, useful standalone)*
2. Chat Polls
3. Granular Profile Visibility *(foundation for privacy-sensitive fields used elsewhere)*
4. Lighter Social Textures (5a–5d, can parallelize)
5. Report/Flag Message
6. Collection Import/Export
7. Electron Bundle (4a → 4b → 4c)
8. Achievement Hunter Badge Sync *(depends on #1)*
9. Loot Box Cosmetic Unlocks *(largest, most cross-cutting — save for last)*
