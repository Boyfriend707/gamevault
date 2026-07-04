import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const decorations = await prisma.decoration.findMany({ orderBy: { name: "asc" } });
    res.json(decorations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch decorations" });
  }
});

export default router;
