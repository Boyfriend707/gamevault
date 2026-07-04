import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { uploadToCloudinary } from "../index.js";

const router = Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticateToken);

// GET /chats -- List user's conversations
router.get("/", async (req, res) => {
  try {
    const convos = await prisma.conversation.findMany({
      where: { participants: { some: { userId: req.userId } } },
      include: {
        participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, role: true, status: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const result = convos.map((c) => {
      const other = c.participants.find((p) => p.userId !== req.userId)?.user;
      return { id: c.id, otherUser: other, lastMessage: c.messages[0] || null, typing: c.typing };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// POST /chats -- Create or get existing conversation
router.post("/", async (req, res) => {
  try {
    const otherId = parseInt(req.body.userId);
    if (!otherId || otherId === req.userId) return res.status(400).json({ error: "Invalid user" });
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: req.userId } } },
          { participants: { some: { userId: otherId } } },
        ],
      },
      include: {
        participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, role: true } } } },
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
        participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, role: true } } } },
      },
    });
    const other = convo.participants.find((p) => p.userId !== req.userId)?.user;
    res.json({ ...convo, otherUser: other });
  } catch (error) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// GET /chats/:id/messages
router.get("/:id/messages", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    const where = { conversationId: convoId };
    if (req.query.after) where.id = { gt: parseInt(req.query.after) };
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
      },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// GET /chats/:id/search
router.get("/:id/search", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const q = req.query.q;
    if (!q) return res.json([]);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    const messages = await prisma.message.findMany({
      where: { conversationId: convoId, content: { contains: q, mode: "insensitive" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true } },
      },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to search messages" });
  }
});

// POST /chats/:id/messages -- Send a message
router.post("/:id/messages", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    const { content, replyToId } = req.body;
    if (!content && !replyToId) return res.status(400).json({ error: "Content required" });
    const msg = await prisma.message.create({
      data: { content: content || "", conversationId: convoId, userId: req.userId, replyToId: replyToId ? parseInt(replyToId) : undefined },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
      },
    });
    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// POST /chats/:id/images -- Upload an image message
router.post("/:id/images", upload.single("image"), async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const result = await uploadToCloudinary(req.file.buffer, { folder: "chat" });
    const msg = await prisma.message.create({
      data: { content: "", imageUrl: result.secure_url, conversationId: convoId, userId: req.userId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
      },
    });
    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// PUT /chats/messages/:messageId -- Edit a message
router.put("/messages/:messageId", async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.userId !== req.userId) return res.status(404).json({ error: "Message not found" });
    const fiveMin = 5 * 60 * 1000;
    if (Date.now() - msg.createdAt.getTime() > fiveMin) return res.status(400).json({ error: "Can only edit within 5 minutes" });
    if (msg.deletedAt) return res.status(400).json({ error: "Message was deleted" });
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content required" });
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true } },
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// DELETE /chats/messages/:messageId -- Soft-delete a message
router.delete("/messages/:messageId", async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.userId !== req.userId) return res.status(404).json({ error: "Message not found" });
    const fiveMin = 5 * 60 * 1000;
    if (Date.now() - msg.createdAt.getTime() > fiveMin) return res.status(400).json({ error: "Can only delete within 5 minutes" });
    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// POST /chats/messages/:messageId/react -- Toggle reaction
router.post("/messages/:messageId/react", async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "Emoji required" });
    let reactions = {};
    try { reactions = msg.reactions ? JSON.parse(msg.reactions) : {}; } catch { reactions = {}; }
    if (!reactions[emoji]) reactions[emoji] = [];
    const idx = reactions[emoji].indexOf(req.userId);
    if (idx > -1) { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
    else { reactions[emoji].push(req.userId); }
    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { reactions: JSON.stringify(reactions) },
    });
    res.json({ id: updated.id, reactions: updated.reactions });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

// POST /chats/:id/typing -- Set typing indicator
router.post("/:id/typing", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    const typing = JSON.stringify({ userId: req.userId, timestamp: Date.now() });
    await prisma.conversation.update({ where: { id: convoId }, data: { typing } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to set typing" });
  }
});

export default router;
