import { Router } from "express";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { generateToken, authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: "Username must be at least 3 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ error: "Username already taken" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashed },
    });

    await prisma.settings.create({
      data: { userId: user.id },
    });

    const token = generateToken(user.id);
    res.status(201).json({ token, user: { id: user.id, username: user.username, displayName: null, avatarUrl: null, role: "user" } });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl, decorationUrl: user.decorationUrl, bannerUrl: user.bannerUrl, bannerCrop: user.bannerCrop, bio: user.bio, status: user.status, accentColor: user.accentColor, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, displayName: true, avatarUrl: true, decorationUrl: true, bannerUrl: true, bannerCrop: true, bio: true, status: true, accentColor: true, role: true, xp: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
