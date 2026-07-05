import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const router = Router();
const prisma = new PrismaClient();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function adminAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Admin auth required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") return res.status(403).json({ error: "Not authorized" });
    req.adminId = decoded.userId;
    next();
  } catch {
    res.status(403).json({ error: "Invalid admin token" });
  }
}

router.post("/auth", async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }
  const token = jwt.sign({ role: "admin", userId: 0 }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

router.get("/users", adminAuth, async (req, res) => {
  try {
    console.log("Admin /users called, adminId:", req.adminId);
    const users = await prisma.user.findMany({
      select: {
        id: true, username: true, displayName: true, avatarUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true, xp: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    console.log("Users found:", users.length);
    res.json(users);
  } catch (error) {
    console.error("Admin /users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true, bannerUrl: true, bannerCrop: true, status: true, accentColor: true, role: true, xp: true, createdAt: true,
        games: { include: { tags: { include: { tag: true } } } },
        steamLink: true,
      },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const settings = await prisma.settings.findUnique({ where: { userId } });
    const unlockedThemes = settings?.unlockedThemes ? JSON.parse(settings.unlockedThemes) : [];
    const completedGoals = settings?.completedGoals ? JSON.parse(settings.completedGoals) : [];

    res.json({ ...user, unlockedThemes, completedGoals });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.put("/users/:id", adminAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role, avatarUrl, xp, unlockThemes, completeGoals } = req.body;
    const data = {};
    if (role !== undefined) data.role = role;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (xp !== undefined) data.xp = parseInt(xp) || 0;

    const user = await prisma.user.update({ where: { id: userId }, data, select: { id: true, username: true, role: true, xp: true, avatarUrl: true } });

    if (unlockThemes !== undefined || completeGoals !== undefined) {
      const settings = await prisma.settings.findUnique({ where: { userId } });
      const unlocked = unlockThemes !== undefined ? unlockThemes : (settings?.unlockedThemes ? JSON.parse(settings.unlockedThemes) : []);
      const completed = completeGoals !== undefined ? completeGoals : (settings?.completedGoals ? JSON.parse(settings.completedGoals) : []);
      await prisma.settings.upsert({
        where: { userId },
        update: { unlockedThemes: JSON.stringify(unlocked), completedGoals: JSON.stringify(completed) },
        create: { userId, unlockedThemes: JSON.stringify(unlocked), completedGoals: JSON.stringify(completed) },
      });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/games/:id", adminAuth, async (req, res) => {
  try {
    await prisma.game.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Game removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete game" });
  }
});

// Badge management
router.post("/badges", adminAuth, async (req, res) => {
  try {
    const { name, description, iconUrl } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const badge = await prisma.badge.create({
      data: { name, description, iconUrl, createdById: req.adminId },
    });
    res.json(badge);
  } catch (error) {
    if (error.code === "P2002") return res.status(400).json({ error: "Badge name already exists" });
    res.status(500).json({ error: "Failed to create badge" });
  }
});

router.get("/badges", adminAuth, async (req, res) => {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } }, createdBy: { select: { username: true } } },
    });
    res.json(badges);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch badges" });
  }
});

router.post("/badges/:badgeId/award", adminAuth, async (req, res) => {
  try {
    const badgeId = parseInt(req.params.badgeId);
    const { userId, note } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const existing = await prisma.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId } } });
    if (existing) return res.status(400).json({ error: "User already has this badge" });
    const userBadge = await prisma.userBadge.create({
      data: { userId, badgeId, awardedById: req.adminId, note },
      include: { badge: true, user: { select: { username: true } } },
    });
    res.json(userBadge);
  } catch (error) {
    res.status(500).json({ error: "Failed to award badge" });
  }
});

router.delete("/badges/:badgeId/award/:userId", adminAuth, async (req, res) => {
  try {
    const badgeId = parseInt(req.params.badgeId);
    const userId = parseInt(req.params.userId);
    await prisma.userBadge.delete({ where: { userId_badgeId: { userId, badgeId } } });
    res.json({ message: "Badge revoked" });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke badge" });
  }
});

router.delete("/badges/:badgeId", adminAuth, async (req, res) => {
  try {
    const badgeId = parseInt(req.params.badgeId);
    await prisma.userBadge.deleteMany({ where: { badgeId } });
    await prisma.badge.delete({ where: { id: badgeId } });
    res.json({ message: "Badge deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete badge" });
  }
});

// GET /admin/reports -- List all reports
router.get("/reports", adminAuth, async (req, res) => {
  try {
    const reports = await prisma.messageReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        reporter: { select: { id: true, username: true, displayName: true } },
        message: { select: { id: true, content: true, imageUrl: true, createdAt: true, userId: true, user: { select: { id: true, username: true, displayName: true } } } },
        resolver: { select: { id: true, username: true } },
      },
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// POST /admin/reports/:reportId/resolve -- Resolve a report
router.post("/reports/:reportId/resolve", adminAuth, async (req, res) => {
  try {
    const reportId = parseInt(req.params.reportId);
    const { action } = req.body;
    if (!["dismiss", "delete_message", "delete_and_warn"].includes(action)) return res.status(400).json({ error: "Invalid action" });
    const report = await prisma.messageReport.findUnique({ where: { id: reportId } });
    if (!report) return res.status(404).json({ error: "Report not found" });
    if (action === "delete_message" || action === "delete_and_warn") {
      await prisma.message.update({ where: { id: report.messageId }, data: { deletedAt: new Date() } });
    }
    await prisma.messageReport.update({
      where: { id: reportId },
      data: { status: "resolved", resolvedById: req.adminId, resolvedAt: new Date() },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve report" });
  }
});

export default router;
