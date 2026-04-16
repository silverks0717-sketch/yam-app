import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

import { env } from "../config.js";

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
      gender: user.gender,
    },
    env.jwtSecret,
    {
      expiresIn: `${env.accessTokenTtlMinutes}m`,
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiresAt() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.refreshTokenTtlDays);
  return expiresAt;
}

export function serializeUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    gender: user.gender,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export function getRequestContext(request) {
  return {
    userAgent: request.headers["user-agent"]?.slice(0, 255) || "",
    ipAddress:
      request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      request.socket.remoteAddress ||
      "",
  };
}
