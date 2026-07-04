import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "./notifications.js";
import { awardXP } from "../xp.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const GOALS = [
  { id: "first-steps", name: "First Steps", desc: "Add your first game", check: (s) => s.totalGames >= 1, unlock: null },
  { id: "collector", name: "Collector", desc: "Add 5 games", check: (s) => s.totalGames >= 5, unlock: null },
  { id: "game-master", name: "Game Master", desc: "Add 25 games", check: (s) => s.totalGames >= 25, unlock: null },
  { id: "dedicated", name: "Dedicated", desc: "Reach 2 hours of playtime", check: (s) => s.totalPlaytime >= 120, unlock: "sunset" },
  { id: "no-life", name: "No Life", desc: "Reach 10 hours of playtime", check: (s) => s.totalPlaytime >= 600, unlock: "nord" },
  { id: "profile-star", name: "Profile Star", desc: "Upload a profile picture", check: (s) => s.avatarSet, unlock: "crimson" },
  { id: "steam-fan", name: "Steam Fan", desc: "Link your Steam account", check: (s) => s.steamLinked, unlock: null },
  { id: "tag-master", name: "Tag Master", desc: "Create 5 tags", check: (s) => s.tagCount >= 5, unlock: null },
  { id: "steam-addict", name: "Steam Addict", desc: "Sync Steam 5 times", check: (s) => s.syncCount >= 5, unlock: null },
  { id: "steam-library", name: "Steam Library", desc: "Import 25 games from Steam", check: (s) => s.steamGameCount >= 25, unlock: null },
  { id: "chatterbox", name: "Chatterbox", desc: "Send 50 chat messages", check: (s) => s.messageCount >= 50, unlock: "ocean" },
  { id: "networker", name: "Networker", desc: "Send 200 chat messages", check: (s) => s.messageCount >= 200, unlock: "cyberpunk" },
  { id: "century", name: "Century", desc: "Add 100 games to your collection", check: (s) => s.totalGames >= 100, unlock: "matrix" },
];

router.get("/", (req, res) => {
  res.json(GOALS);
});

router.post("/check", async (req, res) => {
  try {
    const [games, steamLink, tags, settings, messageCount, user] = await Promise.all([
      prisma.game.findMany({ where: { userId: req.userId } }),
      prisma.steamLink.findUnique({ where: { userId: req.userId } }),
      prisma.tag.findMany({ where: { userId: req.userId } }),
      prisma.settings.findUnique({ where: { userId: req.userId } }),
      prisma.message.count({ where: { userId: req.userId } }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { avatarUrl: true } }),
    ]);

    const totalPlaytime = games.reduce((s, g) => s + g.playtime, 0);
    const totalGames = games.length;
    const completedGames = games.filter((g) => g.status === "completed").length;
    const steamLinked = !!steamLink;
    const syncCount = steamLink?.syncCount || 0;
    const steamGameCount = games.filter((g) => g.steamAppId).length;
    const tagCount = tags.length;
    const avatarSet = !!user?.avatarUrl;

    const stats = { totalPlaytime, totalGames, completedGames, steamLinked, syncCount, steamGameCount, tagCount, messageCount, avatarSet };

    const completed = settings?.completedGoals ? JSON.parse(settings.completedGoals) : [];
    const unlocked = settings?.unlockedThemes ? JSON.parse(settings.unlockedThemes) : [];

    const newCompletions = [];
    const newUnlocks = [];

    for (const goal of GOALS) {
      if (completed.includes(goal.id)) continue;
      if (goal.check(stats)) {
        completed.push(goal.id);
        newCompletions.push(goal);
        if (goal.unlock && !unlocked.includes(goal.unlock)) {
          unlocked.push(goal.unlock);
          newUnlocks.push(goal.unlock);
        }
      }
    }

    if (newCompletions.length > 0) {
      await prisma.settings.upsert({
        where: { userId: req.userId },
        update: { completedGoals: JSON.stringify(completed), unlockedThemes: JSON.stringify(unlocked) },
        create: { userId: req.userId, completedGoals: JSON.stringify(completed), unlockedThemes: JSON.stringify(unlocked) },
      });
      for (const goal of newCompletions) {
        createNotification(req.userId, "goal_completed", "Goal Completed", `You completed "${goal.name}"!`, "/settings");
      }
      awardXP(req.userId, newCompletions.length * 100);
    }

    res.json({ newCompletions, newUnlocks, completed, unlocked });
  } catch (error) {
    res.status(500).json({ error: "Failed to check goals" });
  }
});

export default router;
