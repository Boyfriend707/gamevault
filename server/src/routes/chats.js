import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import { authenticateToken } from "../middleware/auth.js";
import { uploadToCloudinary } from "../index.js";
import { generateResponse, searchWeb, BOT_USERNAME } from "../ai.js";

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
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } }, poll: { select: { question: true } } } },
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
        poll: { include: { votes: { select: { id: true, userId: true, optionId: true } } } },
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
        poll: { include: { votes: { select: { id: true, userId: true, optionId: true } } } },
      },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to search messages" });
  }
});

// POST /chats/:id/messages -- Send a message (text or poll)
router.post("/:id/messages", async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    const { content, replyToId, poll } = req.body;
    if (!content && !replyToId && !poll) return res.status(400).json({ error: "Content or poll required" });
    const msg = await prisma.message.create({
      data: {
        content: content || "",
        conversationId: convoId,
        userId: req.userId,
        replyToId: replyToId ? parseInt(replyToId) : undefined,
        ...(poll ? { poll: { create: { question: poll.question, options: JSON.stringify(poll.options), allowMultiple: poll.allowMultiple || false, closesAt: poll.closesAt ? new Date(poll.closesAt) : undefined } } } : {}),
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
        poll: { include: { votes: { select: { id: true, userId: true, optionId: true } } } },
      },
    });
    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
    res.json(msg);

    if (content?.trim()) {
      triggerBotResponse(convoId, req.userId, content).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

async function triggerBotResponse(convoId, userId, userMessage) {
  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { conversationId: convoId },
      include: { user: { select: { id: true, username: true } } },
    });
    const bot = participants.find((p) => p.user.username === BOT_USERNAME);
    if (!bot) return;

    const recentMsgs = await prisma.message.findMany({
      where: { conversationId: convoId },
      orderBy: { createdAt: "desc" },
      take: 17,
      include: { user: { select: { id: true, username: true } } },
    });
    const history = recentMsgs
      .reverse()
      .filter((m) => m.userId !== bot.userId || m.userId === null)
      .map((m) => ({
        role: m.userId === bot.userId ? "assistant" : "user",
        content: m.content,
      }));

    const lower = userMessage.toLowerCase();
    let context = "";

    if (lower.includes("game") || lower.includes("collection") || lower.includes("play") || lower.includes("playtime") || lower.includes("pc") || lower.includes("steam") || lower.includes("track")) {
      const games = await prisma.game.findMany({ where: { userId } });
      if (games.length > 0) {
        const totalPlaytime = games.reduce((s, g) => s + (g.playtimeHours || 0), 0);
        const byStatus = {};
        games.forEach((g) => { byStatus[g.status || "unknown"] = (byStatus[g.status || "unknown"] || 0) + 1; });
        context += `[User's collection: ${games.length} games, ${totalPlaytime}h total | `;
        context += Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ");
        context += "]\n";
        const top = games.sort((a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0)).slice(0, 5);
        context += `[Top played: ${top.map((g) => `${g.title} (${g.playtimeHours || 0}h)`).join(", ")}]\n`;
      }
    }

    if (lower.includes("friend") || lower.includes("online") || lower.includes("offline")) {
      const friends = await prisma.friend.findMany({
        where: { userId, status: "accepted" },
        include: { friend: { select: { id: true, username: true, displayName: true, status: true, lastSeen: true } } },
      });
      if (friends.length > 0) {
        const online = friends.filter((f) => f.friend.status === "online" || f.friend.status === "online-away");
        context += `[Friends: ${friends.length} total, ${online.length} online]\n`;
        if (online.length > 0) context += `[Online: ${online.map((f) => f.friend.displayName || f.friend.username).join(", ")}]\n`;
      }
    }

    if (lower.includes("profile") || lower.includes("level") || lower.includes("xp") || lower.includes("badge") || lower.includes("rank")) {
      const userData = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true, xp: true, role: true, bio: true, statusMessage: true } });
      if (userData) {
        const level = Math.floor(Math.pow((userData.xp || 0) / 100, 0.6));
        context += `[Profile: ${userData.displayName || userData.username} | Level ${level} | ${userData.xp || 0} XP | Role: ${userData.role}]\n`;
      }
    }

    if (lower.includes("challenge") || lower.includes("streak") || lower.includes("daily")) {
      const today = await prisma.dailyChallenge.findMany({ where: { userId, date: { gte: new Date(new Date() - 86400000 * 7) } }, orderBy: { date: "desc" } });
      const streak = await prisma.loginStreak.findUnique({ where: { userId } });
      if (today.length > 0) context += `[Challenges last 7d: ${today.filter((c) => c.completed).length}/${today.length} completed]\n`;
      if (streak) context += `[Login streak: ${streak.count} days]\n`;
    }

    const searchMatch = lower.match(/(?:search|google|look up|find|what is|who is|tell me about)\s+(.+)/i);
    if (searchMatch) {
      const query = searchMatch[1].replace(/^(?:on google|online|for me)\s+/i, "");
      const searchResult = await searchWeb(query);
      if (searchResult) context += `[Web search for "${query}": ${searchResult.slice(0, 500)}]\n`;
    }

    const messageWithContext = context ? `${context}\n${userMessage}` : userMessage;
    const reply = await generateResponse(messageWithContext, history);
    if (!reply) return;
    await prisma.message.create({
      data: { content: reply, conversationId: convoId, userId: bot.userId },
    });
    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
  } catch (e) { console.error("Bot response error:", e.message); }
}

// POST /chats/:id/images -- Upload an image message
router.post("/:id/images", upload.single("image"), async (req, res) => {
  try {
    const convoId = parseInt(req.params.id);
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convoId, userId: req.userId } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant" });
    if (!req.file) return res.status(400).json({ error: "No image provided" });
    const url = await uploadToCloudinary(req.file.buffer, undefined, { folder: "chat" });
    const msg = await prisma.message.create({
      data: { content: "", imageUrl: url, conversationId: convoId, userId: req.userId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
        poll: { include: { votes: { select: { id: true, userId: true, optionId: true } } } },
      },
    });
    await prisma.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// POST /chats/messages/:messageId/vote -- Vote on a poll
router.post("/messages/:messageId/vote", async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const msg = await prisma.message.findUnique({ where: { id: messageId }, include: { poll: true } });
    if (!msg || !msg.poll) return res.status(404).json({ error: "Poll not found" });
    if (msg.poll.closesAt && new Date() > msg.poll.closesAt) return res.status(400).json({ error: "Poll has closed" });
    const userId = req.userId;
    const { optionId } = req.body;
    if (!optionId) return res.status(400).json({ error: "optionId required" });
    const options = JSON.parse(msg.poll.options);
    if (!options.some((o) => o.id === optionId)) return res.status(400).json({ error: "Invalid option" });
    if (!msg.poll.allowMultiple) {
      const existing = await prisma.pollVote.findFirst({ where: { pollId: msg.poll.id, userId } });
      if (existing) return res.status(400).json({ error: "Already voted" });
    } else {
      const existing = await prisma.pollVote.findUnique({ where: { pollId_userId_optionId: { pollId: msg.poll.id, userId, optionId } } });
      if (existing) return res.status(400).json({ error: "Already voted for this option" });
    }
    await prisma.pollVote.create({ data: { pollId: msg.poll.id, userId, optionId } });
    const updated = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true } },
        replyTo: { select: { id: true, content: true, imageUrl: true, userId: true } },
        poll: { include: { votes: { select: { id: true, userId: true, optionId: true } } } },
      },
    });
    res.json(updated);
  } catch (error) {
    if (error.code === "P2002") return res.status(400).json({ error: "Already voted" });
    res.status(500).json({ error: "Failed to vote" });
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

// POST /chats/messages/:messageId/report -- Report a message
router.post("/messages/:messageId/report", async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const msg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.userId === req.userId) return res.status(400).json({ error: "Cannot report your own message" });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "Reason required" });
    const existing = await prisma.messageReport.findUnique({ where: { messageId_reporterId: { messageId, reporterId: req.userId } } });
    if (existing) return res.status(400).json({ error: "Already reported this message" });
    const report = await prisma.messageReport.create({
      data: { messageId, reporterId: req.userId, reason },
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: "Failed to report message" });
  }
});

export default router;
