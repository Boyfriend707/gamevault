import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function awardXP(userId, amount) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, unopenedCrates: true },
    });
    if (!user) return null;
    const newXP = user.xp + amount;
    const newLevel = Math.floor(Math.pow(newXP / 100, 0.6));
    let cratesAwarded = 0;
    let updateData = { xp: newXP, level: newLevel };
    if (newLevel > user.level) {
      cratesAwarded = newLevel - user.level;
      updateData.unopenedCrates = user.unopenedCrates + cratesAwarded;
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { xp: true, level: true, unopenedCrates: true },
    });
    return { ...updated, cratesAwarded, leveledUp: cratesAwarded > 0 };
  } catch (e) {
    console.error("Failed to award XP:", e);
    return null;
  }
}

export function calcLevel(xp) {
  return Math.floor(Math.pow(xp / 100, 0.6));
}
