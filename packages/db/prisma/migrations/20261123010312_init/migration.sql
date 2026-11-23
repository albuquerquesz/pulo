-- CreateEnum
CREATE TYPE "block_kind" AS ENUM ('foco', 'descanso');

-- CreateEnum
CREATE TYPE "focus_session_state" AS ENUM ('em_andamento', 'concluida', 'interrompida');

-- CreateEnum
CREATE TYPE "period" AS ENUM ('manha', 'tarde', 'noite');

-- CreateEnum
CREATE TYPE "proposal_state" AS ENUM ('pendente', 'aceita', 'editada', 'negada', 'expirada');

-- CreateEnum
CREATE TYPE "proposal_origin" AS ENUM ('ia', 'regra');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_block" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startMinutes" SMALLINT NOT NULL,
    "durationMinutes" SMALLINT NOT NULL,
    "kind" "block_kind" NOT NULL,
    "title" TEXT,

    CONSTRAINT "routine_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weekdays" SMALLINT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_log" (
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "doneAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "habit_log_pkey" PRIMARY KEY ("habitId","date")
);

-- CreateTable
CREATE TABLE "focus_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockId" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3),
    "plannedMinutes" SMALLINT NOT NULL,
    "state" "focus_session_state" NOT NULL,
    "pausedMs" INTEGER NOT NULL DEFAULT 0,
    "pausedSince" TIMESTAMPTZ(3),

    CONSTRAINT "focus_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_in" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "period" "period" NOT NULL,
    "energy" SMALLINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "check_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rest_day" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "rest_day_pkey" PRIMARY KEY ("userId","date")
);

-- CreateTable
CREATE TABLE "weekly_proposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "state" "proposal_state" NOT NULL,
    "patternText" TEXT NOT NULL,
    "reasonText" TEXT,
    "changes" JSONB NOT NULL,
    "origin" "proposal_origin" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "weekly_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mascot_state" (
    "userId" TEXT NOT NULL,
    "phase" SMALLINT NOT NULL,
    "careDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mascot_state_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "routine_block_userId_weekday_startMinutes_idx" ON "routine_block"("userId", "weekday", "startMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "routine_block_id_userId_key" ON "routine_block"("id", "userId");

-- CreateIndex
CREATE INDEX "habit_userId_active_idx" ON "habit"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "habit_id_userId_key" ON "habit"("id", "userId");

-- CreateIndex
CREATE INDEX "habit_log_userId_date_idx" ON "habit_log"("userId", "date");

-- CreateIndex
CREATE INDEX "focus_session_userId_startedAt_idx" ON "focus_session"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "focus_session_blockId_idx" ON "focus_session"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "focus_session_id_userId_key" ON "focus_session"("id", "userId");

-- CreateIndex
CREATE INDEX "check_in_userId_date_idx" ON "check_in"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "check_in_id_userId_key" ON "check_in"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_proposal_id_userId_key" ON "weekly_proposal"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_proposal_userId_weekStart_key" ON "weekly_proposal"("userId", "weekStart");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_block" ADD CONSTRAINT "routine_block_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit" ADD CONSTRAINT "habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_log" ADD CONSTRAINT "habit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_log" ADD CONSTRAINT "habit_log_habitId_userId_fkey" FOREIGN KEY ("habitId", "userId") REFERENCES "habit"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "routine_block"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_in" ADD CONSTRAINT "check_in_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rest_day" ADD CONSTRAINT "rest_day_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_proposal" ADD CONSTRAINT "weekly_proposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mascot_state" ADD CONSTRAINT "mascot_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
