import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const notes = await prisma.vibeNote.findMany({
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vibes" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { content, imageUrl, color } = req.body;
    if (!content && !imageUrl) return res.status(400).json({ error: "Content or image required" });
    const note = await prisma.vibeNote.create({
      data: { content: content || null, imageUrl: imageUrl || null, color: color || "#fef08a", authorId: req.userId },
      include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: "Failed to create vibe note" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const note = await prisma.vibeNote.findUnique({ where: { id } });
    if (!note) return res.status(404).json({ error: "Note not found" });
    if (note.authorId !== req.userId && req.userRole !== "admin") return res.status(403).json({ error: "Not authorized" });
    await prisma.vibeNote.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete vibe note" });
  }
});

export default router;
