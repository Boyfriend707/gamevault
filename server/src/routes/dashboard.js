import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/celebrations-today", async (req, res) => {
  try {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    const birthdays = await prisma.$queryRawUnsafe(
      `SELECT id, username, "displayName", "avatarUrl", "decorationUrl" FROM "User" WHERE EXTRACT(MONTH FROM birthday) = $1 AND EXTRACT(DAY FROM birthday) = $2 AND id != $3`,
      month, day, req.userId
    );

    const anniversaries = await prisma.$queryRawUnsafe(
      `SELECT id, username, "displayName", "avatarUrl", "decorationUrl" FROM "User" WHERE EXTRACT(MONTH FROM "createdAt") = $1 AND EXTRACT(DAY FROM "createdAt") = $2 AND id != $3 AND EXTRACT(YEAR FROM "createdAt") != EXTRACT(YEAR FROM NOW())`,
      month, day, req.userId
    );

    res.json({ birthdays, anniversaries });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch celebrations" });
  }
});

export default router;
