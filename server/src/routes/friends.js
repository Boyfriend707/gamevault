import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "./notifications.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/search/:username", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true },
    });

    if (!user || user.id === req.userId) {
      return res.json(null);
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/request/:userId", async (req, res) => {
  try {
    const receiverId = parseInt(req.params.userId);

    if (receiverId === req.userId) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    const existing = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId: req.userId, receiverId } },
    });

    if (existing) {
      return res.status(409).json({ error: "Friend request already sent" });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) {
      return res.status(404).json({ error: "User not found" });
    }

    const request = await prisma.friendRequest.create({
      data: { senderId: req.userId, receiverId },
    });

    const sender = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true } });
    createNotification(receiverId, "friend_request", "Friend Request", `${sender.username} wants to be friends!`, "/settings");

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: "Failed to send friend request" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { receiverId: req.userId, status: "pending" },
      include: { sender: { select: { id: true, username: true, displayName: true, role: true } } },
    });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/requests/:id/accept", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== req.userId) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request already handled" });
    }

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: "accepted" },
      }),
      prisma.friendship.create({
        data: { userId: request.senderId, friendId: request.receiverId },
      }),
      prisma.friendship.create({
        data: { userId: request.receiverId, friendId: request.senderId },
      }),
    ]);

    const accepter = await prisma.user.findUnique({ where: { id: req.userId }, select: { username: true, displayName: true } });
    createNotification(request.senderId, "friend_accepted", "Friend Request Accepted", `${accepter.displayName || accepter.username} accepted your friend request!`, `/profile/${req.userId}`);

    res.json({ message: "Friend request accepted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept request" });
  }
});

router.post("/requests/:id/decline", async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.receiverId !== req.userId) {
      return res.status(404).json({ error: "Request not found" });
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: "declined" },
    });

    res.json({ message: "Friend request declined" });
  } catch (error) {
    res.status(500).json({ error: "Failed to decline request" });
  }
});

router.get("/", async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { userId: req.userId },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            decorationUrl: true,
            bannerUrl: true,
            bannerCrop: true,
            status: true,
            accentColor: true,
            role: true,
            steamLink: { select: { onlineStatus: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    res.json(friendships.map((f) => f.friend));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch friends" });
  }
});

router.get("/leaderboard", async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { userId: req.userId },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            games: { select: { playtime: true } },
          },
        },
      },
    });

    const leaderboard = friendships
      .map((f) => ({
        user: {
          id: f.friend.id,
          username: f.friend.username,
          displayName: f.friend.displayName,
          avatarUrl: f.friend.avatarUrl,
        },
        totalPlaytime: f.friend.games.reduce((sum, g) => sum + g.playtime, 0),
      }))
      .sort((a, b) => b.totalPlaytime - a.totalPlaytime);

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/:id/profile", async (req, res) => {
  try {
    const friendId = parseInt(req.params.id);

    const friendship = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: req.userId, friendId } },
    });

    if (!friendship) {
      return res.status(403).json({ error: "Not friends with this user" });
    }

    const profile = await prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        decorationUrl: true,
        bannerUrl: true,
        bannerCrop: true,
        status: true,
        accentColor: true,
        role: true,
        games: { include: { tags: { include: { tag: true } } } },
        steamLink: { select: { onlineStatus: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
