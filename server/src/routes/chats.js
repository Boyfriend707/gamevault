import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const convos = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.userId } } },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true } } },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(convos.map((c) => {
      const other = c.participants.find((p) => p.userId !== req.userId)?.user;
      return { ...c, otherUser: other, lastMessage: c.messages[0] || null, messages: undefined };
    }));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId: otherId } = req.body;
    if (!otherId || otherId === req.userId) {
      return res.status(400).json({ error: "Invalid user" });
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.userId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true } } },
        },
      },
    });

    if (existing) {
      const other = existing.participants.find((p) => p.userId !== req.userId)?.user;
      return res.json({ ...existing, otherUser: other });
    }

    const convo = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId: req.userId }, { userId: otherId }],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true } } },
        },
      },
    });

    const other = convo.participants.find((p) => p.userId !== req.userId)?.user;
    res.json({ ...convo, otherUser: other });
  } catch (error) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/:id/messages", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const { after } = req.query;

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not in this conversation" });

    const where = { conversationId: convoId };
    if (after) where.id = { gt: parseInt(after) };

    const messages = await prisma.message.findMany({
      where,
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/:id/messages", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Message is required" });

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not in this conversation" });

    const message = await prisma.message.create({
      data: { content, conversationId: convoId, userId: req.userId },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true } } },
    });

    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
