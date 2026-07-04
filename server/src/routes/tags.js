import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { awardXP } from "../xp.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.userId },
      orderBy: { name: "asc" },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Tag name required" });
    }
    const tag = await prisma.tag.create({
      data: { name: name.trim(), userId: req.userId },
    });
    awardXP(req.userId, 10);
    res.status(201).json(tag);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Tag already exists" });
    }
    res.status(500).json({ error: "Failed to create tag" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag || tag.userId !== req.userId) {
      return res.status(404).json({ error: "Tag not found" });
    }
    await prisma.tag.delete({ where: { id: tagId } });
    res.json({ message: "Tag deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
