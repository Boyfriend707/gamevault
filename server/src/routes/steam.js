import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { authenticateToken } from "../middleware/auth.js";
import { awardXP } from "../xp.js";

const router = Router();
const prisma = new PrismaClient();

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";

function getServerUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

router.get("/link-url", authenticateToken, (req, res) => {
  const serverUrl = getServerUrl(req);
  const redirectUri = `${serverUrl}/api/steam/callback?userId=${req.userId}`;
  const realm = serverUrl;
  const url = `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(redirectUri)}&openid.realm=${encodeURIComponent(realm)}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;

  res.json({ url });
});

router.get("/callback", async (req, res) => {
  try {
    const { "openid.claimed_id": claimedId, userId } = req.query;
    const steamId = claimedId?.split("/").pop();

    if (!steamId || !userId) {
      return res.send(callbackPage(false));
    }

    const playerResp = await axios.get(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/`,
      { params: { key: STEAM_API_KEY, steamids: steamId } }
    );

    const player = playerResp.data?.response?.players?.[0];

    await prisma.steamLink.upsert({
      where: { userId: parseInt(userId) },
      update: {
        steamId,
        displayName: player?.personaname,
        avatarUrl: player?.avatarmedium,
        profileUrl: player?.profileurl,
        onlineStatus: player?.personastate || 0,
        lastSynced: new Date(),
      },
      create: {
        steamId,
        userId: parseInt(userId),
        displayName: player?.personaname,
        avatarUrl: player?.avatarmedium,
        profileUrl: player?.profileurl,
        onlineStatus: player?.personastate || 0,
        lastSynced: new Date(),
      },
    });

    res.send(callbackPage(true));
  } catch (error) {
    res.send(callbackPage(false));
  }
});

function callbackPage(success) {
  return `<!DOCTYPE html><html><head><title>GameVault - Steam</title><style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa;color:#111827}.card{text-align:center;background:white;padding:2.5rem;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:400px}h2{margin:0 0 .5rem}p{color:#6b7280;margin:0 0 1.5rem;font-size:.875rem}.check{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:24px}.check.ok{background:#dcfce7;color:#166534}.check.fail{background:#fef2f2;color:#ef4444}</style></head><body><div class="card"><div class="check ${success ? "ok" : "fail"}">${success ? "✓" : "✗"}</div><h2>${success ? "Steam Linked!" : "Link Failed"}</h2><p>${success ? "Your Steam account has been linked. You can close this window." : "Something went wrong. Try again from the settings page."}</p></div></body></html>`;
}

router.get("/status", authenticateToken, async (req, res) => {
  try {
    const link = await prisma.steamLink.findUnique({ where: { userId: req.userId } });

    if (!link) {
      return res.json({ linked: false });
    }

    return res.json({
      linked: true,
      steamId: link.steamId,
      displayName: link.displayName,
      avatarUrl: link.avatarUrl,
      profileUrl: link.profileUrl,
      onlineStatus: link.onlineStatus,
      lastSynced: link.lastSynced,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Steam status" });
  }
});

router.post("/sync", authenticateToken, async (req, res) => {
  try {
    const link = await prisma.steamLink.findUnique({ where: { userId: req.userId } });

    if (!link) {
      return res.status(400).json({ error: "No Steam account linked" });
    }

    const [playerResp, gamesResp] = await Promise.all([
      axios.get("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/", {
        params: { key: STEAM_API_KEY, steamids: link.steamId },
      }),
      axios.get("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/", {
        params: { key: STEAM_API_KEY, steamid: link.steamId, include_appinfo: true, include_played_free_games: true, format: "json" },
      }),
    ]);

    const player = playerResp.data?.response?.players?.[0];
    const games = gamesResp.data?.response?.games || [];

    await prisma.steamLink.update({
      where: { userId: req.userId },
      data: {
        displayName: player?.personaname,
        avatarUrl: player?.avatarmedium,
        onlineStatus: player?.personastate || 0,
        lastSynced: new Date(),
        syncCount: { increment: 1 },
      },
    });

    for (const game of games) {
      const existing = await prisma.game.findFirst({
        where: { userId: req.userId, name: game.name },
      });

      if (existing) {
        if (game.playtime_forever && game.playtime_forever > existing.playtime) {
          await prisma.game.update({
            where: { id: existing.id },
            data: { playtime: game.playtime_forever },
          });
        }
      } else {
        await prisma.game.create({
          data: {
            name: game.name,
            platform: "Steam",
            steamAppId: game.appid,
            userId: req.userId,
            playtime: game.playtime_forever || 0,
            coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appid}/library_600x900.jpg`,
          },
        });
      }
    }

    awardXP(req.userId, 30);
    res.json({ message: "Sync complete", gamesAdded: games.length });
  } catch (error) {
    res.status(500).json({ error: "Sync failed" });
  }
});

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

router.post("/sync-achievements", authenticateToken, async (req, res) => {
  try {
    const link = await prisma.steamLink.findUnique({ where: { userId: req.userId } });
    if (!link) return res.status(400).json({ error: "No Steam account linked" });

    if (!STEAM_API_KEY) return res.status(400).json({ error: "Steam API key not configured" });

    const games = await prisma.game.findMany({
      where: { userId: req.userId, steamAppId: { not: null } },
      select: { id: true, steamAppId: true, name: true },
    });

    if (games.length === 0) return res.json({ message: "No Steam games in collection", total: 0, new: 0 });

    let totalAchievements = 0;
    let newBadges = 0;

    for (const game of games) {
      try {
        await sleep(500);
        const resp = await axios.get(
          "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/",
          { params: { appid: game.steamAppId, key: STEAM_API_KEY, steamid: link.steamId } }
        );

        const achievements = resp.data?.playerstats?.achievements || [];
        for (const ach of achievements) {
          if (ach.achieved === 1) {
            totalAchievements++;
            const badgeName = `ACH: ${game.name} - ${ach.name}`;
            const badgeApiName = `steam_ach_${game.steamAppId}_${ach.apiname || ach.name}`.replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 100);

            let badge = await prisma.badge.findUnique({ where: { name: badgeApiName } });
            if (!badge) {
              badge = await prisma.badge.create({
                data: {
                  name: badgeApiName,
                  iconUrl: null,
                  description: `Earned "${ach.name}" in ${game.name}`,
                  isSystemBadge: true,
                },
              });
            }

            const existing = await prisma.userBadge.findUnique({
              where: { userId_badgeId: { userId: req.userId, badgeId: badge.id } },
            });
            if (!existing) {
              await prisma.userBadge.create({
                data: { userId: req.userId, badgeId: badge.id },
              });
              newBadges++;
            }
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch achievements for ${game.name} (app ${game.steamAppId}):`, e.message);
      }
    }

    await prisma.steamLink.update({
      where: { userId: req.userId },
      data: { lastSynced: new Date(), syncCount: { increment: 1 } },
    });

    if (newBadges > 0) {
      await awardXP(req.userId, newBadges * 10);
    }

    res.json({ message: "Achievements synced", total: totalAchievements, new: newBadges });
  } catch (error) {
    res.status(500).json({ error: "Achievement sync failed" });
  }
});

router.delete("/unlink", authenticateToken, async (req, res) => {
  try {
    await prisma.steamLink.deleteMany({ where: { userId: req.userId } });
    res.json({ message: "Steam account unlinked" });
  } catch (error) {
    res.status(500).json({ error: "Failed to unlink Steam account" });
  }
});

export default router;
