import { prisma } from "../lib/prisma.js";
import { serializeUser, verifyAccessToken } from "../lib/auth.js";

function readBearerToken(request) {
  const header = request.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export async function requireAuth(request, response, next) {
  const token = readBearerToken(request);

  if (!token) {
    response.status(401).json({ error: "请先登录" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      response.status(401).json({ error: "登录状态已失效" });
      return;
    }

    if (user.status !== "ACTIVE") {
      response.status(403).json({ error: "账号已被冻结" });
      return;
    }

    request.user = user;
    request.publicUser = serializeUser(user);
    next();
  } catch (error) {
    response.status(401).json({ error: "登录状态已失效" });
  }
}

export function requireAdmin(request, response, next) {
  if (!request.user || request.user.role !== "ADMIN") {
    response.status(403).json({ error: "没有管理员权限" });
    return;
  }

  next();
}
