import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { awardXP } from "../xp.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, platform, notes, coverUrl, localPath, steamAppId, status, tagIds } = req.body;

    if (!name || !platform) {
      return res.status(400).json({ error: "Name and platform required" });
    }

    const game = await prisma.game.create({
      data: {
        name,
        platform,
        notes,
        coverUrl,
        localPath,
        steamAppId: steamAppId ? parseInt(steamAppId) : undefined,
        playtime: 0,
        status: status || "not-playing",
        userId: req.userId,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    awardXP(req.userId, 25);

    res.status(201).json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to add game" });
  }
});

router.get("/playtime", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, platform: true, playtime: true },
      orderBy: { playtime: "desc" },
    });

    const total = games.reduce((sum, g) => sum + g.playtime, 0);

    res.json({ games, total });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch playtime data" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const games = await prisma.game.findMany({ where: { userId: req.userId } });

    const totalPlaytime = games.reduce((sum, g) => sum + g.playtime, 0);

    const stats = {
      total: games.length,
      playing: games.filter((g) => g.status === "playing").length,
      completed: games.filter((g) => g.status === "completed").length,
      backlog: games.filter((g) => g.status === "not-playing").length,
      totalPlaytime,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/pinned", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId, pinned: true },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pinned games" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const game = await prisma.game.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
      include: { tags: { include: { tag: true } }, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch game" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { tagIds, steamAppId, ...data } = req.body;

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        ...data,
        ...(steamAppId !== undefined ? { steamAppId: steamAppId ? parseInt(steamAppId) : null } : {}),
        tags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update game" });
  }
});

router.get("/pinned", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId, pinned: true },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pinned games" });
  }
});

router.put("/:id/pin", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    const maxPins = user?.role === "vip" || user?.role === "admin" ? 5 : 3;

    const pinnedCount = await prisma.game.count({ where: { userId: req.userId, pinned: true } });
    if (pinnedCount >= maxPins && !game.pinned) {
      return res.status(400).json({ error: `Max ${maxPins} pinned games${user?.role === "vip" || user?.role === "admin" ? "" : " (3 for regular, 5 for VIP)"}` });
    }

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { pinned: !game.pinned },
      include: { tags: { include: { tag: true } } },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});

router.patch("/:id/notes", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { notes } = req.body;
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { notes: notes || null },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notes" });
  }
});

router.put("/:id/rating", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const { rating } = req.body;
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.userId !== req.userId) return res.status(404).json({ error: "Game not found" });
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { rating: rating || null },
      include: { tags: { include: { tag: true } } },
    });
    awardXP(req.userId, 20);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rating" });
  }
});

router.put("/:id/playtime", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { minutes } = req.body;
    if (typeof minutes !== "number" || minutes < 0) {
      return res.status(400).json({ error: "Minutes must be a positive number" });
    }

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { playtime: game.playtime + minutes },
    });

    await prisma.playSession.create({
      data: { gameId, userId: req.userId, minutes },
    });

    awardXP(req.userId, minutes);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update playtime" });
  }
});

router.get("/:id/sessions", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const sessions = await prisma.playSession.findMany({
      where: { gameId, userId: req.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    await prisma.game.delete({ where: { id: gameId } });
    res.json({ message: "Game removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete game" });
  }
});

export default router;
