import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [
          { creatorId: req.userId },
          { participants: { some: { userId: req.userId } } },
        ],
      },
      include: {
        game: { select: { id: true, name: true, coverUrl: true } },
        creator: { select: { id: true, username: true, displayName: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(challenges);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch challenges" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, gameId, endDate } = req.body;
    if (!name?.trim() || !gameId || !endDate) {
      return res.status(400).json({ error: "Name, gameId, and endDate required" });
    }

    const game = await prisma.game.findFirst({ where: { id: parseInt(gameId), userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found in your collection" });

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: req.userId,
        gameId: parseInt(gameId),
        name: name.trim(),
        startDate: new Date(),
        endDate: new Date(endDate),
      },
      include: {
        game: { select: { id: true, name: true, coverUrl: true } },
        creator: { select: { id: true, username: true, displayName: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    res.status(201).json(challenge);
  } catch (error) {
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

router.post("/:id/join", async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    const existing = await prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId: req.userId } },
    });
    if (existing) return res.status(409).json({ error: "Already joined" });

    const participant = await prisma.challengeParticipant.create({
      data: { challengeId, userId: req.userId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json(participant);
  } catch (error) {
    res.status(500).json({ error: "Failed to join challenge" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        game: { select: { id: true, name: true, coverUrl: true } },
        creator: { select: { id: true, username: true, displayName: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!challenge) return res.status(404).json({ error: "Challenge not found" });

    const isParticipant = challenge.participants.some((p) => p.userId === req.userId);
    if (challenge.creatorId !== req.userId && !isParticipant) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json(challenge);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch challenge" });
  }
});

router.post("/:id/check", async (req, res) => {
  try {
    const challengeId = parseInt(req.params.id);
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) return res.status(404).json({ error: "Challenge not found" });
    if (challenge.creatorId !== req.userId) return res.status(403).json({ error: "Only the creator can check winners" });

    for (const participant of challenge.participants) {
      const sessions = await prisma.playSession.findMany({
        where: {
          userId: participant.userId,
          gameId: challenge.gameId,
          createdAt: { gte: challenge.startDate, lte: challenge.endDate },
        },
      });

      const totalPlaytime = sessions.reduce((sum, s) => sum + s.minutes, 0);
      await prisma.challengeParticipant.update({
        where: { id: participant.id },
        data: { playtime: totalPlaytime },
      });
    }

    const updated = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const maxPlaytime = Math.max(...updated.participants.map((p) => p.playtime), 0);
    if (maxPlaytime > 0) {
      for (const p of updated.participants) {
        if (p.playtime === maxPlaytime) {
          await prisma.challengeParticipant.update({
            where: { id: p.id },
            data: { won: true },
          });
        }
      }
    }

    const final = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        game: { select: { id: true, name: true, coverUrl: true } },
        creator: { select: { id: true, username: true, displayName: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    res.json(final);
  } catch (error) {
    res.status(500).json({ error: "Failed to check challenge" });
  }
});

export default router;
