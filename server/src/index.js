import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

import authRoutes from "./routes/auth.js";
import friendsRoutes from "./routes/friends.js";
import gamesRoutes from "./routes/games.js";
import steamRoutes from "./routes/steam.js";
import settingsRoutes from "./routes/settings.js";
import tagsRoutes from "./routes/tags.js";
import goalsRoutes from "./routes/goals.js";
import adminRoutes from "./routes/admin.js";
import decorationsRoutes from "./routes/decorations.js";
import usersRoutes from "./routes/users.js";
import chatsRoutes from "./routes/chats.js";
import notificationsRoutes from "./routes/notifications.js";
import challengesRoutes from "./routes/challenges.js";
import dailyChallengesRoutes from "./routes/dailyChallenges.js";
import { authenticateToken } from "./middleware/auth.js";

const app = express();
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

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const publicDir = process.env.PUBLIC_DIR || path.resolve(__dirname, "../../client/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.use("/api/auth", authRoutes);
app.use("/api/friends", friendsRoutes);
app.use("/api/games", gamesRoutes);
app.use("/api/steam", steamRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tags", tagsRoutes);
app.use("/api/goals", goalsRoutes);
app.use("/api/decorations", decorationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/challenges", challengesRoutes);
app.use("/api/daily-challenges", dailyChallengesRoutes);
app.post("/api/avatar", authenticateToken, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = await uploadToCloudinary(req.file.buffer, `avatar-${req.userId}`);
    await prisma.user.update({
      where: { id: req.userId },
      data: { avatarUrl: url },
    });
    res.json({ avatarUrl: url });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

app.post("/api/banner", authenticateToken, upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = await uploadToCloudinary(req.file.buffer, `banner-${req.userId}`);
    await prisma.user.update({
      where: { id: req.userId },
      data: { bannerUrl: url },
    });
    res.json({ bannerUrl: url });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload banner" });
  }
});

app.post("/api/games/cover", authenticateToken, upload.single("cover"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = await uploadToCloudinary(req.file.buffer, `cover-${req.userId}-${Date.now()}`);
    res.json({ coverUrl: url });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload cover" });
  }
});

app.post("/api/background", authenticateToken, upload.single("background"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = await uploadToCloudinary(req.file.buffer, `bg-${req.userId}`);
    res.json({ backgroundUrl: url });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload background" });
  }
});

async function requireAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
    if (decoded.role !== "admin") return res.status(403).json({ error: "Admin only" });
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

app.post("/api/admin/decorations", authenticateToken, requireAdmin, upload.single("decoration"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const name = path.parse(req.file.originalname).name;
    const publicId = `decoration-${Date.now()}`;
    const url = await uploadToCloudinary(req.file.buffer, publicId);
    const deco = await prisma.decoration.create({ data: { name, fileUrl: url } });
    res.json(deco);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload decoration" });
  }
});

app.put("/api/admin/decorations/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const deco = await prisma.decoration.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name.trim() },
    });
    res.json(deco);
  } catch (error) {
    res.status(500).json({ error: "Failed to rename decoration" });
  }
});

app.delete("/api/admin/decorations/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deco = await prisma.decoration.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!deco) return res.status(404).json({ error: "Decoration not found" });
    const publicId = deco.fileUrl.split("/").pop().replace(/\.[^.]+$/, "");
    await cloudinary.uploader.destroy(publicId).catch(() => {});
    await prisma.decoration.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Decoration deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete decoration" });
  }
});

// Protect decoration upload/delete with admin check
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/update", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.resolve("updates/version.json"), "utf-8"));
    data.downloadUrl = `/updates/${data.installer}`;
    res.json(data);
  } catch {
    res.json({ version: "1.0.0", downloadUrl: null, notes: "No update info available" });
  }
});

app.use("/updates", express.static(path.resolve("updates")));

if (process.env.NODE_ENV === "production" && fs.existsSync(publicDir)) {
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/updates")) {
      res.sendFile(path.join(publicDir, "index.html"));
    }
  });
}

const PORT = process.env.PORT || 3001;

async function main() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GameVault server running on port ${PORT}`);
  });
}

main();
