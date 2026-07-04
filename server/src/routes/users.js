import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.get("/:id/profile", authenticateToken, async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const viewerId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        decorationUrl: true,
        bannerUrl: true,
        bannerCrop: true,
        bio: true,
        status: true,
        accentColor: true,
        role: true,
        xp: true,
        createdAt: true,
        games: {
          include: { tags: { include: { tag: true } } },
        },
        steamLink: {
          select: { onlineStatus: true, displayName: true, avatarUrl: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const total = user.games.length;
    const playing = user.games.filter((g) => g.status === "playing").length;
    const completed = user.games.filter((g) => g.status === "completed").length;
    const notPlaying = user.games.filter((g) => g.status === "not-playing").length;
    const totalPlaytime = user.games.reduce((sum, g) => sum + g.playtime, 0);

    res.json({
      ...user,
      stats: { total, playing, completed, notPlaying, totalPlaytime },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/:id/milestones", authenticateToken, async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);

    const milestones = await prisma.gameMilestone.findMany({
      where: {
        userId: profileId,
        completed: true,
      },
      include: {
        game: { select: { id: true, name: true, coverUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

export default router;
