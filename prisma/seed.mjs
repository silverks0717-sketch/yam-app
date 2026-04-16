import bcrypt from "bcryptjs";
import { PrismaClient, UserGender, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@yam.local";
  const password = process.env.ADMIN_PASSWORD || "Admin123456!";
  const gender = process.env.ADMIN_GENDER === "MALE" ? UserGender.MALE : UserGender.FEMALE;

  const existing = await prisma.user.findFirst({
    where: {
      role: UserRole.ADMIN,
    },
  });

  if (existing) {
    console.log(`已存在管理员：${existing.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      gender,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`已创建默认管理员：${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
