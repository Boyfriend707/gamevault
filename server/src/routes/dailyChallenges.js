import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { awardXP } from "../xp.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const CHALLENGE_TYPES = [
  { type: "play_minutes", name: "Game Time", description: "Play games for {req} minutes today", requirement: 30, xpReward: 100 },
  { type: "add_games", name: "Collection Builder", description: "Add {req} new game(s) to your collection", requirement: 2, xpReward: 50 },
  { type: "rate_games", name: "Critic", description: "Rate {req} game(s) today", requirement: 3, xpReward: 50 },
  { type: "send_messages", name: "Social Butterfly", description: "Send {req} message(s) in chat", requirement: 5, xpReward: 30 },
  { type: "login_streak", name: "Dedicated", description: "Maintain your login streak", requirement: 1, xpReward: 25 },
];

// POST /daily-challenges/check -- Called on app startup. Ensures today's challenges exist, updates login streak.
router.post("/check", async (req, res) => {
  try {
    const today = getToday();
    const todayEnd = new Date(today.getTime() + 86400000);

    // Ensure all challenge types exist for today
    for (const ct of CHALLENGE_TYPES) {
      const existing = await prisma.dailyChallenge.findFirst({
        where: { type: ct.type, date: today },
      });
      if (!existing) {
        await prisma.dailyChallenge.create({
          data: {
            name: ct.name,
            description: ct.description.replace("{req}", ct.requirement),
            type: ct.type,
            requirement: ct.requirement,
            xpReward: ct.xpReward,
            date: today,
          },
        });
      }
    }

    // Update login streak
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { lastLoginDate: true, loginStreak: true } });
    if (user) {
      const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
      let streak = user.loginStreak || 0;
      const lastLoginDay = lastLogin ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()) : null;
      const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const yesterdayDay = getYesterday();

      if (!lastLoginDay || lastLoginDay.getTime() < todayDay.getTime()) {
        if (lastLoginDay && lastLoginDay.getTime() === yesterdayDay.getTime()) {
          streak += 1;
        } else if (!lastLoginDay) {
          streak = 1;
        } else {
          streak = 1;
        }
        await prisma.user.update({
          where: { id: req.userId },
          data: { loginStreak: streak, lastLoginDate: new Date() },
        });
      }
    }

    // Get or create progress records for today's challenges
    const challenges = await prisma.dailyChallenge.findMany({
      where: { date: today },
    });

    // Compute progress for each challenge type based on today's activity
    // play_minutes: sum PlaySession minutes from today
    const playSessions = await prisma.playSession.aggregate({
      where: { userId: req.userId, createdAt: { gte: today, lt: todayEnd } },
      _sum: { minutes: true },
    });
    const playedMinutes = playSessions._sum.minutes || 0;

    // add_games: count games created today
    const gamesToday = await prisma.game.count({
      where: { userId: req.userId, createdAt: { gte: today, lt: todayEnd } },
    });

    // rate_games: count games with rating updated today
    const ratedToday = await prisma.game.count({
      where: { userId: req.userId, rating: { not: null }, updatedAt: { gte: today, lt: todayEnd } },
    });

    // send_messages: count messages sent today
    const msgsToday = await prisma.message.count({
      where: { userId: req.userId, createdAt: { gte: today, lt: todayEnd } },
    });

    const todayData = {};

    for (const challenge of challenges) {
      let progress = 0;
      if (challenge.type === "play_minutes") progress = playedMinutes;
      else if (challenge.type === "add_games") progress = gamesToday;
      else if (challenge.type === "rate_games") progress = ratedToday;
      else if (challenge.type === "send_messages") progress = msgsToday;
      else if (challenge.type === "login_streak") progress = streak >= 1 ? 1 : 0;

      const completed = progress >= challenge.requirement;

      const existingProgress = await prisma.dailyChallengeProgress.findUnique({
        where: { dailyChallengeId_userId: { dailyChallengeId: challenge.id, userId: req.userId } },
      });

      if (existingProgress) {
        const wasCompleted = existingProgress.completed;
        await prisma.dailyChallengeProgress.update({
          where: { id: existingProgress.id },
          data: { progress, completed },
        });
        // Award XP on first completion
        if (completed && !wasCompleted) {
          await awardXP(req.userId, challenge.xpReward);
        }
      } else {
        await prisma.dailyChallengeProgress.create({
          data: { dailyChallengeId: challenge.id, userId: req.userId, progress, completed },
        });
        // Award XP if already completed on creation
        if (completed) {
          await awardXP(req.userId, challenge.xpReward);
        }
      }

      todayData[challenge.type] = { id: challenge.id, name: challenge.name, description: challenge.description, requirement: challenge.requirement, xpReward: challenge.xpReward, progress, completed };
    }

    res.json({ loginStreak: streak, challenges: todayData });
  } catch (error) {
    res.status(500).json({ error: "Failed to check daily challenges" });
  }
});

// GET /daily-challenges -- Get today's challenges with user progress
router.get("/", async (req, res) => {
  try {
    const today = getToday();
    const challenges = await prisma.dailyChallenge.findMany({
      where: { date: today },
      orderBy: { id: "asc" },
    });
    const result = [];
    for (const challenge of challenges) {
      let progress = null;
      try {
        progress = await prisma.dailyChallengeProgress.findUnique({
          where: { dailyChallengeId_userId: { dailyChallengeId: challenge.id, userId: req.userId } },
        });
      } catch {}
      result.push({
        id: challenge.id,
        name: challenge.name,
        description: challenge.description,
        type: challenge.type,
        requirement: challenge.requirement,
        xpReward: challenge.xpReward,
        progress: progress ? progress.progress : 0,
        completed: progress ? progress.completed : false,
      });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch daily challenges" });
  }
});

export default router;
