import { PrismaClient } from "@prisma/client";

export const prisma = globalThis.__yamPrisma || new PrismaClient();

if (!globalThis.__yamPrisma) {
  globalThis.__yamPrisma = prisma;
}
