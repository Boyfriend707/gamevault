import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.js";
import { awardXP } from "../xp.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import net from "net";

const router = Router();
const prisma = new PrismaClient();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

function uploadToCloudinary(buffer, publicId, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "image", ...opts },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

router.use(authenticateToken);

router.get("/", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId },
      include: { tags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, platform, notes, coverUrl, localPath, steamAppId, status, tagIds } = req.body;

    if (!name || !platform) {
      return res.status(400).json({ error: "Name and platform required" });
    }

    const game = await prisma.game.create({
      data: {
        name,
        platform,
        notes,
        coverUrl,
        localPath,
        steamAppId: steamAppId ? parseInt(steamAppId) : undefined,
        playtime: 0,
        status: status || "not-playing",
        userId: req.userId,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    awardXP(req.userId, 25);

    res.status(201).json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to add game" });
  }
});

router.get("/playtime", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, platform: true, playtime: true },
      orderBy: { playtime: "desc" },
    });

    const total = games.reduce((sum, g) => sum + g.playtime, 0);

    res.json({ games, total });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch playtime data" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const games = await prisma.game.findMany({ where: { userId: req.userId } });

    const totalPlaytime = games.reduce((sum, g) => sum + g.playtime, 0);

    const stats = {
      total: games.length,
      playing: games.filter((g) => g.status === "playing").length,
      completed: games.filter((g) => g.status === "completed").length,
      backlog: games.filter((g) => g.status === "not-playing").length,
      totalPlaytime,
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/random", async (req, res) => {
  try {
    const where = { userId: req.userId };
    if (req.query.status) {
      where.status = req.query.status;
    }

    const count = await prisma.game.count({ where });
    if (count === 0) return res.json(null);

    const skip = Math.floor(Math.random() * count);
    const game = await prisma.game.findFirst({
      where,
      skip,
      include: { tags: { include: { tag: true } } },
    });

    res.json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to pick random game" });
  }
});

router.get("/pinned", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId, pinned: true },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(games);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pinned games" });
  }
});

router.post("/server-status", async (req, res) => {
  try {
    const { host, port } = req.body;
    if (!host || !port) {
      return res.status(400).json({ error: "Host and port required" });
    }

    const online = await new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(parseInt(port), host);
    });

    res.json({ online });
  } catch (error) {
    res.status(500).json({ error: "Failed to check server status" });
  }
});

router.get("/:id/servers", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const servers = await prisma.gameServer.findMany({ where: { gameId } });
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch servers" });
  }
});

router.post("/:id/servers", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const { host, port, label } = req.body;
    if (!host || !port) return res.status(400).json({ error: "Host and port required" });

    const server = await prisma.gameServer.create({
      data: { gameId, host, port: parseInt(port), label },
    });

    res.status(201).json(server);
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ error: "Server already exists" });
    res.status(500).json({ error: "Failed to add server" });
  }
});

router.delete("/servers/:serverId", async (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const server = await prisma.gameServer.findUnique({ where: { id: serverId } });
    if (!server) return res.status(404).json({ error: "Server not found" });

    const game = await prisma.game.findFirst({ where: { id: server.gameId, userId: req.userId } });
    if (!game) return res.status(403).json({ error: "Not authorized" });

    await prisma.gameServer.delete({ where: { id: serverId } });
    res.json({ message: "Server deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete server" });
  }
});

router.get("/:id/screenshots", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const screenshots = await prisma.gameScreenshot.findMany({
      where: { gameId },
      orderBy: { createdAt: "desc" },
    });
    res.json(screenshots);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch screenshots" });
  }
});

router.post("/:id/screenshots", upload.single("screenshot"), async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const url = await uploadToCloudinary(req.file.buffer, `screenshot-${req.userId}-${Date.now()}`, { folder: "screenshots" });

    const screenshot = await prisma.gameScreenshot.create({
      data: { gameId, userId: req.userId, url, caption: req.body.caption || "" },
    });

    res.status(201).json(screenshot);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload screenshot" });
  }
});

router.delete("/screenshots/:screenshotId", async (req, res) => {
  try {
    const screenshotId = parseInt(req.params.screenshotId);
    const screenshot = await prisma.gameScreenshot.findUnique({ where: { id: screenshotId } });
    if (!screenshot) return res.status(404).json({ error: "Screenshot not found" });
    if (screenshot.userId !== req.userId) return res.status(403).json({ error: "Not authorized" });

    const publicId = screenshot.url.split("/").pop().replace(/\.[^.]+$/, "");
    await cloudinary.uploader.destroy(publicId).catch(() => {});

    await prisma.gameScreenshot.delete({ where: { id: screenshotId } });
    res.json({ message: "Screenshot deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete screenshot" });
  }
});

router.get("/:id/milestones", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const milestones = await prisma.gameMilestone.findMany({
      where: { gameId, userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.post("/:id/milestones", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findFirst({ where: { id: gameId, userId: req.userId } });
    if (!game) return res.status(404).json({ error: "Game not found" });

    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });

    const milestone = await prisma.gameMilestone.create({
      data: { gameId, userId: req.userId, title: title.trim() },
    });

    res.status(201).json(milestone);
  } catch (error) {
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.put("/milestones/:milestoneId", async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.milestoneId);
    const milestone = await prisma.gameMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.userId !== req.userId) return res.status(404).json({ error: "Milestone not found" });

    const updated = await prisma.gameMilestone.update({
      where: { id: milestoneId },
      data: { completed: !milestone.completed },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle milestone" });
  }
});

router.delete("/milestones/:milestoneId", async (req, res) => {
  try {
    const milestoneId = parseInt(req.params.milestoneId);
    const milestone = await prisma.gameMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone || milestone.userId !== req.userId) return res.status(404).json({ error: "Milestone not found" });

    await prisma.gameMilestone.delete({ where: { id: milestoneId } });
    res.json({ message: "Milestone deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const game = await prisma.game.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
      include: { tags: { include: { tag: true } }, user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    if (!game) return res.status(404).json({ error: "Game not found" });
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch game" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { tagIds, steamAppId, ...data } = req.body;

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: {
        ...data,
        ...(steamAppId !== undefined ? { steamAppId: steamAppId ? parseInt(steamAppId) : null } : {}),
        tags: tagIds
          ? {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update game" });
  }
});

router.put("/:id/pin", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    const maxPins = user?.role === "vip" || user?.role === "admin" ? 5 : 3;

    const pinnedCount = await prisma.game.count({ where: { userId: req.userId, pinned: true } });
    if (pinnedCount >= maxPins && !game.pinned) {
      return res.status(400).json({ error: `Max ${maxPins} pinned games${user?.role === "vip" || user?.role === "admin" ? "" : " (3 for regular, 5 for VIP)"}` });
    }

    const newPinned = !game.pinned;
    const data = { pinned: newPinned };
    if (newPinned) {
      const maxPinOrder = await prisma.game.aggregate({ where: { userId: req.userId, pinned: true }, _max: { pinOrder: true } });
      data.pinOrder = (maxPinOrder._max.pinOrder || 0) + 1;
    } else {
      data.pinOrder = 0;
    }
    const updated = await prisma.game.update({
      where: { id: gameId },
      data,
      include: { tags: { include: { tag: true } } },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});

router.put("/:id/card-color", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.userId !== req.userId) return res.status(404).json({ error: "Game not found" });
    const { cardColor } = req.body;
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { cardColor: cardColor || null },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update card color" });
  }
});

router.put("/pin-order", async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "Order must be an array of game IDs" });
    for (let i = 0; i < order.length; i++) {
      await prisma.game.updateMany({
        where: { id: order[i], userId: req.userId },
        data: { pinOrder: i + 1 },
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reorder pins" });
  }
});

router.patch("/:id/notes", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { notes } = req.body;
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { notes: notes || null },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notes" });
  }
});

router.put("/:id/rating", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const { rating } = req.body;
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.userId !== req.userId) return res.status(404).json({ error: "Game not found" });
    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { rating: rating || null },
      include: { tags: { include: { tag: true } } },
    });
    awardXP(req.userId, 20);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update rating" });
  }
});

router.put("/:id/playtime", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    const { minutes } = req.body;
    if (typeof minutes !== "number" || minutes < 0) {
      return res.status(400).json({ error: "Minutes must be a positive number" });
    }

    const updated = await prisma.game.update({
      where: { id: gameId },
      data: { playtime: game.playtime + minutes },
    });

    await prisma.playSession.create({
      data: { gameId, userId: req.userId, minutes },
    });

    awardXP(req.userId, minutes);

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update playtime" });
  }
});

router.get("/:id/sessions", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const sessions = await prisma.playSession.findMany({
      where: { gameId, userId: req.userId },
      orderBy: { createdAt: "asc" },
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const game = await prisma.game.findUnique({ where: { id: gameId } });

    if (!game || game.userId !== req.userId) {
      return res.status(404).json({ error: "Game not found" });
    }

    await prisma.game.delete({ where: { id: gameId } });
    res.json({ message: "Game removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete game" });
  }
});

// GET /games/export-csv -- Export collection as CSV
router.get("/export-csv", async (req, res) => {
  try {
    const games = await prisma.game.findMany({
      where: { userId: req.userId },
      orderBy: { name: "asc" },
      include: { tags: { include: { tag: true } } },
    });
    const { stringify } = await import("csv-stringify/sync");
    const records = games.map((g) => ({
      title: g.name,
      platform: g.platform || "",
      status: g.status,
      playtime_hours: Math.round((g.playtime / 60) * 10) / 10,
      source: g.source || "manual",
      tags: g.tags.map((t) => t.tag.name).join("; "),
    }));
    const csv = stringify(records, { header: true, columns: ["title", "platform", "status", "playtime_hours", "source", "tags"] });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=gamevault-collection.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// POST /games/import-csv -- Import collection from CSV
router.post("/import-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No CSV file uploaded" });
    const { parse } = await import("csv-parse/sync");
    const csv = req.file.buffer.toString("utf-8");
    const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
    const results = { imported: 0, skipped: 0, errors: [] };
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const title = row.title?.trim();
      if (!title) { results.errors.push({ row: i + 1, error: "Missing title" }); continue; }
      const existing = await prisma.game.findFirst({ where: { userId: req.userId, name: { equals: title, mode: "insensitive" } } });
      if (existing) { results.skipped++; continue; }
      const playtime = row.playtime_hours ? Math.round(parseFloat(row.playtime_hours) * 60) : 0;
      const status = ["playing", "completed", "dropped", "backlog"].includes(row.status?.trim()) ? row.status.trim() : "not-playing";
      const source = ["steam", "manual", "epic", "gog", "itchio", "other"].includes(row.source?.trim()) ? row.source.trim() : "manual";
      try {
        const game = await prisma.game.create({
          data: { name: title, userId: req.userId, platform: row.platform?.trim() || null, status, playtime, source },
        });
        if (row.tags?.trim()) {
          const tagNames = row.tags.split(";").map((t) => t.trim()).filter(Boolean);
          for (const tagName of tagNames) {
            const tag = await prisma.tag.upsert({ where: { userId_name: { userId: req.userId, name: tagName } }, update: {}, create: { userId: req.userId, name: tagName } });
            await prisma.gameTag.create({ data: { gameId: game.id, tagId: tag.id } }).catch(() => {});
          }
        }
        results.imported++;
      } catch (err) {
        results.errors.push({ row: i + 1, error: err.message });
      }
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

export default router;
