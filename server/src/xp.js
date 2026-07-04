import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function awardXP(userId, amount) {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
      select: { xp: true },
    });
    return user.xp;
  } catch (e) {
    console.error("Failed to award XP:", e);
    return null;
  }
}

export function calcLevel(xp) {
  return Math.floor(Math.pow(xp / 100, 0.6));
}
