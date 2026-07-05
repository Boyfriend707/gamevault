import { Router } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { userId: req.userId } });

    if (!settings) {
      settings = await prisma.settings.create({ data: { userId: req.userId } });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/", async (req, res) => {
  try {
    const { theme, unlockedThemes, completedGoals, background, shortcuts, fontSize, density, reducedMotion, bgType, bgVideo } = req.body;
    const data = {};
    if (theme !== undefined) data.theme = theme;
    if (unlockedThemes !== undefined) data.unlockedThemes = unlockedThemes;
    if (completedGoals !== undefined) data.completedGoals = completedGoals;
    if (background !== undefined) data.background = background;
    if (shortcuts !== undefined) data.shortcuts = shortcuts;
    if (fontSize !== undefined) data.fontSize = fontSize;
    if (density !== undefined) data.density = density;
    if (reducedMotion !== undefined) data.reducedMotion = reducedMotion;
    if (bgType !== undefined) data.bgType = bgType;
    if (bgVideo !== undefined) data.bgVideo = bgVideo;

    const settings = await prisma.settings.upsert({
      where: { userId: req.userId },
      update: data,
      create: { userId: req.userId, theme: theme || "light" },
    });

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.put("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);

    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed },
    });

    res.json({ message: "Password updated" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

router.put("/display-name", async (req, res) => {
  try {
    const { displayName } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { displayName: displayName || null },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update display name" });
  }
});

router.put("/bio", async (req, res) => {
  try {
    const { bio } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { bio },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bio" });
  }
});

router.put("/status", async (req, res) => {
  try {
    const { status } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { status: status || null },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.put("/banner-crop", async (req, res) => {
  try {
    const { bannerCrop } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { bannerCrop: bannerCrop || null },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update banner crop" });
  }
});

router.put("/accent-color", async (req, res) => {
  try {
    const { accentColor } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { accentColor: accentColor || null },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update accent color" });
  }
});

router.put("/profile-theme", async (req, res) => {
  try {
    const { profileTheme } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { profileTheme },
    });
    res.json({ profileTheme });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile theme" });
  }
});

router.put("/decoration", async (req, res) => {
  try {
    const { decorationUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { decorationUrl },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update decoration" });
  }
});

router.get("/visibility", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { visibility: true } });
    const DEFAULT_VISIBILITY = { bio: "public", games: "public", stats: "public", badges: "public", friends: "public", currentlyPlaying: "public" };
    const vis = user?.visibility ? { ...DEFAULT_VISIBILITY, ...JSON.parse(user.visibility) } : DEFAULT_VISIBILITY;
    res.json(vis);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch visibility" });
  }
});

router.put("/visibility", async (req, res) => {
  try {
    const { visibility } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { visibility: JSON.stringify(visibility) },
      select: { visibility: true },
    });
    res.json({ visibility: user.visibility ? JSON.parse(user.visibility) : null });
  } catch (error) {
    res.status(500).json({ error: "Failed to update visibility" });
  }
});

export default router;
