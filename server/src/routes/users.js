import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const DEFAULT_VISIBILITY = { bio: "public", games: "public", stats: "public", badges: "public", friends: "public", currentlyPlaying: "public" };

function canView(viewerIsOwner, viewerIsFriend, level) {
  if (level === "public") return true;
  if (level === "friends") return viewerIsFriend;
  if (level === "private") return viewerIsOwner;
  return true;
}

// GET /users/:id/profile
router.get("/:id/profile", async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, statusMessage: true, statusEmoji: true, accentColor: true, role: true, xp: true, createdAt: true, profileTheme: true, loginStreak: true, visibility: true, birthday: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const viewerId = req.userId;
    const isOwner = viewerId === userId;
    const visibility = user.visibility ? { ...DEFAULT_VISIBILITY, ...JSON.parse(user.visibility) } : DEFAULT_VISIBILITY;

    // Check if viewer is a friend
    let isFriend = false;
    if (viewerId && viewerId !== userId) {
      const f1 = await prisma.friendship.findUnique({ where: { userId_friendId: { userId: viewerId, friendId: userId } } });
      const f2 = await prisma.friendship.findUnique({ where: { userId_friendId: { userId, friendId: viewerId } } });
      isFriend = !!(f1 || f2);
    }

    // Bio
    const showBio = canView(isOwner, isFriend, visibility.bio);

    // Games
    const showGames = canView(isOwner, isFriend, visibility.games);
    const games = showGames ? await prisma.game.findMany({
      where: { userId },
      include: { tags: { include: { tag: true } } },
      orderBy: [{ pinned: "desc" }, { pinOrder: "asc" }, { updatedAt: "desc" }],
    }) : [];

    // Stats
    const showStats = canView(isOwner, isFriend, visibility.stats);
    const stats = showStats ? { total: games.length, playing: games.filter((g) => g.status === "playing").length, completed: games.filter((g) => g.status === "completed").length, notPlaying: games.filter((g) => g.status === "not-playing" || g.status === "dropped").length, totalPlaytime: games.reduce((s, g) => s + g.playtime, 0) } : null;

    // Currently Playing (separate from stats, but derived from games)
    const showPlaying = canView(isOwner, isFriend, visibility.currentlyPlaying);
    const playingGames = showPlaying ? games.filter((g) => g.status === "playing") : [];

    // Steam link
    const steamLink = await prisma.steamLink.findUnique({ where: { userId } });

    // Friend count
    const showFriends = canView(isOwner, isFriend, visibility.friends);
    const friendCount = showFriends ? (await prisma.friendship.count({ where: { userId } }) + await prisma.friendship.count({ where: { friendId: userId } })) : null;

    // Badges
    const showBadges = canView(isOwner, isFriend, visibility.badges);
    const badges = showBadges ? await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    }) : [];

    // Profile reactions (grouped counts + who reacted)
    let reactions = [];
    if (viewerId) {
      const allReactions = await prisma.profileReaction.findMany({
        where: { profileUserId: userId },
        include: { reactor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      });
      const grouped = {};
      allReactions.forEach((r) => {
        if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, reactors: [] };
        grouped[r.emoji].count++;
        grouped[r.emoji].reactors.push(r.reactor);
      });
      reactions = Object.entries(grouped).map(([emoji, data]) => ({ emoji, ...data }));
    }

    // Mutual friends (only if friends visibility allows)
    let mutualFriends = [];
    if (showFriends && viewerId && viewerId !== userId) {
      const viewerFriends1 = await prisma.friendship.findMany({ where: { userId: viewerId }, select: { friendId: true } });
      const viewerFriends2 = await prisma.friendship.findMany({ where: { friendId: viewerId }, select: { userId: true } });
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

    res.json({
      ...user, visibility,
      bio: showBio ? user.bio : null,
      games, stats, friendCount,
      playingGames,
      steamLink,
      badges: badges.map(b => ({ id: b.badge.id, name: b.badge.name, iconUrl: b.badge.iconUrl, description: b.badge.description, awardedAt: b.awardedAt })),
      reactions, mutualFriends,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// POST /users/:id/reactions -- Upsert profile reaction
router.post("/:id/reactions", async (req, res) => {
  try {
    const profileUserId = parseInt(req.params.id);
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "Emoji required" });
    await prisma.profileReaction.upsert({
      where: { profileUserId_reactorId: { profileUserId, reactorId: req.userId } },
      update: { emoji },
      create: { profileUserId, reactorId: req.userId, emoji },
    });
    const allReactions = await prisma.profileReaction.findMany({
      where: { profileUserId },
      include: { reactor: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    const grouped = {};
    allReactions.forEach((r) => {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, reactors: [] };
      grouped[r.emoji].count++;
      grouped[r.emoji].reactors.push(r.reactor);
    });
    const reactions = Object.entries(grouped).map(([emoji, data]) => ({ emoji, ...data }));
    res.json(reactions);
  } catch (error) {
    res.status(500).json({ error: "Failed to update reaction" });
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
