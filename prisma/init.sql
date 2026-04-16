-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'FROZEN');

-- CreateEnum
CREATE TYPE "public"."UserGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "public"."ExportType" AS ENUM ('USER_XLSX', 'ADMIN_USER_XLSX');

-- CreateEnum
CREATE TYPE "public"."ExportStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "gender" "public"."UserGender" NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "timeKey" VARCHAR(5),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "mealType" VARCHAR(20) NOT NULL,
    "foodName" VARCHAR(120) NOT NULL,
    "portion" VARCHAR(40),
    "highCalorie" BOOLEAN NOT NULL DEFAULT false,
    "social" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."trainings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "timeKey" VARCHAR(5),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "trainingName" VARCHAR(120) NOT NULL,
    "duration" INTEGER,
    "details" VARCHAR(500),
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "sets" INTEGER,
    "note" VARCHAR(240),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."body_metrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" VARCHAR(10) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "bodyFat" DOUBLE PRECISION,
    "boneMuscle" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exports" (
    "id" TEXT NOT NULL,
    "type" "public"."ExportType" NOT NULL,
    "status" "public"."ExportStatus" NOT NULL DEFAULT 'GENERATED',
    "fileName" VARCHAR(180) NOT NULL,
    "meta" JSONB,
    "subjectUserId" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "entityType" VARCHAR(30) NOT NULL,
    "entityId" VARCHAR(120),
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key" ON "public"."user_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_expiresAt_idx" ON "public"."user_sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "meals_userId_occurredAt_idx" ON "public"."meals"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "meals_userId_dateKey_idx" ON "public"."meals"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "trainings_userId_occurredAt_idx" ON "public"."trainings"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "trainings_userId_dateKey_idx" ON "public"."trainings"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "body_metrics_userId_occurredAt_idx" ON "public"."body_metrics"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "body_metrics_userId_dateKey_idx" ON "public"."body_metrics"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "exports_subjectUserId_createdAt_idx" ON "public"."exports"("subjectUserId", "createdAt");

-- CreateIndex
CREATE INDEX "exports_requestedById_createdAt_idx" ON "public"."exports"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "admin_logs_actorId_createdAt_idx" ON "public"."admin_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_logs_targetUserId_createdAt_idx" ON "public"."admin_logs"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "public"."activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_action_createdAt_idx" ON "public"."activity_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meals" ADD CONSTRAINT "meals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."trainings" ADD CONSTRAINT "trainings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."body_metrics" ADD CONSTRAINT "body_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exports" ADD CONSTRAINT "exports_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exports" ADD CONSTRAINT "exports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_logs" ADD CONSTRAINT "admin_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_logs" ADD CONSTRAINT "admin_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
