-- Metas de longo prazo (aba Metas). Os marcos ficam num JSONB junto da meta.
-- CreateEnum
CREATE TYPE "goal_state" AS ENUM ('ativa', 'concluida');

-- CreateTable
CREATE TABLE "goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT,
    "targetDate" DATE,
    "state" "goal_state" NOT NULL,
    "milestones" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_userId_state_idx" ON "goal"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "goal_id_userId_key" ON "goal"("id", "userId");

-- AddForeignKey
ALTER TABLE "goal" ADD CONSTRAINT "goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "goal"
  ADD CONSTRAINT "goal_completed_check" CHECK (("state" = 'concluida') = ("completedAt" IS NOT NULL)),
  ADD CONSTRAINT "goal_milestones_check" CHECK (jsonb_typeof("milestones") = 'array');
