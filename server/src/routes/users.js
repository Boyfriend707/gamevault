import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /users/:id/profile
router.get("/:id/profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true, xp: true, createdAt: true, profileTheme: true, loginStreak: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    const games = await prisma.game.findMany({
      where: { userId },
      include: { tags: { include: { tag: true } } },
      orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { updatedAt: "desc" }],
    });
    const steamLink = await prisma.steamLink.findUnique({ where: { userId } });
    const stats = { total: games.length, playing: games.filter((g) => g.status === "playing").length, completed: games.filter((g) => g.status === "completed").length, notPlaying: games.filter((g) => g.status === "not-playing" || g.status === "dropped").length, totalPlaytime: games.reduce((s, g) => s + g.playtime, 0) };
    
    // Friend count
    const friendCount = await prisma.friendship.count({ where: { userId } }) + await prisma.friendship.count({ where: { friendId: userId } });
    
    // Badges
    const badges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    });

    // Mutual friends (if viewer is logged in and not the same user)
    let mutualFriends = [];
    if (req.userId && req.userId !== userId) {
      const viewerFriends1 = await prisma.friendship.findMany({ where: { userId: req.userId }, select: { friendId: true } });
      const viewerFriends2 = await prisma.friendship.findMany({ where: { friendId: req.userId }, select: { userId: true } });
      const viewerFriendIds = new Set([...viewerFriends1.map(f => f.friendId), ...viewerFriends2.map(f => f.userId)]);
      const profileFriends1 = await prisma.friendship.findMany({ where: { userId }, select: { friendId: true } });
      const profileFriends2 = await prisma.friendship.findMany({ where: { friendId: userId }, select: { userId: true } });
      const profileFriendIds = new Set([...profileFriends1.map(f => f.friendId), ...profileFriends2.map(f => f.userId)]);
      const mutualIds = [...viewerFriendIds].filter(id => profileFriendIds.has(id));
      if (mutualIds.length > 0) {
        const mutualUsers = await prisma.user.findMany({ where: { id: { in: mutualIds } }, select: { id: true, username: true, displayName: true, avatarUrl: true } });
        mutualFriends = mutualUsers;
      }
    }

    res.json({ ...user, games, steamLink, stats, friendCount, badges: badges.map(b => ({ id: b.badge.id, name: b.badge.name, iconUrl: b.badge.iconUrl, description: b.badge.description, awardedAt: b.awardedAt })), mutualFriends });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// GET /users/:id/milestones
router.get("/:id/milestones", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const milestones = await prisma.gameMilestone.findMany({
      where: { userId, completed: true },
      include: { game: { select: { id: true, name: true, coverUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

export default router;
