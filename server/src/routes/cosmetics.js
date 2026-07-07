import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const prisma = new PrismaClient();
const router = Router();

const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 30,
  rare: 12,
  epic: 6,
  legendary: 2,
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

function weightedRandom() {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const rarity of RARITY_ORDER) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll <= 0) return rarity;
  }
  return "common";
}

// List all cosmetics (admin)
router.get("/", authenticateToken, async (req, res) => {
  const items = await prisma.cosmeticItem.findMany({ orderBy: { createdAt: "desc" } });
  res.json(items);
});

// List user's owned cosmetics
router.get("/mine", authenticateToken, async (req, res) => {
  const items = await prisma.userCosmetic.findMany({
    where: { userId: req.userId },
    include: { cosmetic: true },
    orderBy: { unlockedAt: "desc" },
  });
  res.json(items);
});

// Open a crate
router.post("/open-crate", authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { unopenedCrates: true },
  });
  if (!user || user.unopenedCrates < 1) {
    return res.status(400).json({ error: "No crates to open" });
  }

  const rarity = weightedRandom();
  const pool = await prisma.cosmeticItem.findMany({ where: { rarity } });
  if (pool.length === 0) {
    return res.status(400).json({ error: `No ${rarity} cosmetics available` });
  }

  const cosmetic = pool[Math.floor(Math.random() * pool.length)];

  const existing = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId: req.userId, cosmeticId: cosmetic.id } },
  });

  if (!existing) {
    await prisma.userCosmetic.create({
      data: { userId: req.userId, cosmeticId: cosmetic.id },
    });
  }

  await prisma.user.update({
    where: { id: req.userId },
    data: { unopenedCrates: { decrement: 1 } },
  });

  res.json({ cosmetic, wasNew: !existing });
});

// Buy crates with XP
router.post("/buy-crate", authenticateToken, async (req, res) => {
  try {
    const { quantity = 1 } = req.body;
    const qty = Math.min(Math.max(1, parseInt(quantity) || 1), 100);
    const cost = 500 * qty;
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { xp: true },
    });
    if (!user || user.xp < cost) {
      return res.status(400).json({ error: `Need ${cost} XP, you have ${user?.xp || 0}` });
    }
    await prisma.user.update({
      where: { id: req.userId },
      data: { xp: { decrement: cost }, unopenedCrates: { increment: qty } },
    });
    res.json({ cratesAdded: qty, xpSpent: cost });
  } catch (error) {
    res.status(500).json({ error: "Failed to buy crates" });
  }
});

// Sell a cosmetic item for XP (80% of base value)
const SELL_PRICES = { common: 50, uncommon: 100, rare: 250, epic: 500, legendary: 1000 };
router.post("/sell/:id", authenticateToken, async (req, res) => {
  try {
    const uc = await prisma.userCosmetic.findFirst({
      where: { id: parseInt(req.params.id), userId: req.userId },
      include: { cosmetic: true },
    });
    if (!uc) return res.status(404).json({ error: "Not found" });
    if (uc.equipped) return res.status(400).json({ error: "Unequip before selling" });
    const basePrice = SELL_PRICES[uc.cosmetic.rarity] || 25;
    const refund = Math.floor(basePrice * 0.8);
    await prisma.userCosmetic.delete({ where: { id: uc.id } });
    await prisma.user.update({ where: { id: req.userId }, data: { xp: { increment: refund } } });
    res.json({ sold: uc.cosmetic.name, rarity: uc.cosmetic.rarity, xpRefunded: refund });
  } catch (error) {
    res.status(500).json({ error: "Failed to sell item" });
  }
});

// Toggle equip
router.put("/:id/equip", authenticateToken, async (req, res) => {
  const uc = await prisma.userCosmetic.findFirst({
    where: { id: parseInt(req.params.id), userId: req.userId },
  });
  if (!uc) return res.status(404).json({ error: "Not found" });

  const updated = await prisma.userCosmetic.update({
    where: { id: uc.id },
    data: { equipped: !uc.equipped },
  });
  res.json(updated);
});

// Admin: create cosmetic
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  const { name, type, rarity, imageUrl, unlockMessage } = req.body;
  if (!RARITY_ORDER.includes(rarity)) {
    return res.status(400).json({ error: "Invalid rarity" });
  }
  const item = await prisma.cosmeticItem.create({
    data: { name, type, rarity, imageUrl, unlockMessage },
  });
  res.status(201).json(item);
});

// Admin: seed sample cosmetics
router.post("/seed", authenticateToken, requireAdmin, async (req, res) => {
  const samples = [
    { name: "Classic Frame", type: "profile_frame", rarity: "common", unlockMessage: "A simple starting frame" },
    { name: "Wooden Frame", type: "profile_frame", rarity: "common" },
    { name: "Stone Frame", type: "profile_frame", rarity: "uncommon" },
    { name: "Golden Frame", type: "profile_frame", rarity: "rare", unlockMessage: "Shine bright!" },
    { name: "Crystal Frame", type: "profile_frame", rarity: "epic" },
    { name: "Dragon Frame", type: "profile_frame", rarity: "legendary", unlockMessage: "The ultimate frame" },
    { name: "Default Bubble", type: "chat_bubble", rarity: "common" },
    { name: "Rounded Bubble", type: "chat_bubble", rarity: "common" },
    { name: "Neon Bubble", type: "chat_bubble", rarity: "uncommon" },
    { name: "Gradient Bubble", type: "chat_bubble", rarity: "rare" },
    { name: "Glow Bubble", type: "chat_bubble", rarity: "epic" },
    { name: "Galaxy Bubble", type: "chat_bubble", rarity: "legendary" },
    { name: "White Name", type: "name_color", rarity: "common" },
    { name: "Blue Name", type: "name_color", rarity: "common" },
    { name: "Green Name", type: "name_color", rarity: "uncommon" },
    { name: "Purple Name", type: "name_color", rarity: "rare" },
    { name: "Orange Name", type: "name_color", rarity: "epic" },
    { name: "Rainbow Name", type: "name_color", rarity: "legendary", unlockMessage: "All colors, all glory" },
    { name: "Bronze Badge", type: "badge_variant", rarity: "common" },
    { name: "Silver Badge", type: "badge_variant", rarity: "uncommon" },
    { name: "Gold Badge", type: "badge_variant", rarity: "rare" },
    { name: "Platinum Badge", type: "badge_variant", rarity: "epic" },
    { name: "Diamond Badge", type: "badge_variant", rarity: "legendary" },
  ];

  let count = 0;
  for (const s of samples) {
    const exists = await prisma.cosmeticItem.findFirst({ where: { name: s.name } });
    if (!exists) {
      await prisma.cosmeticItem.create({ data: s });
      count++;
    }
  }
  res.json({ seeded: count });
});

export default router;
