-- Spec 16: metas com ícone e cor, hábito atrelado a uma meta e baú da meta. Nenhum dado é apagado.
-- CreateEnum
CREATE TYPE "accent_color" AS ENUM ('sapo', 'agua', 'foco', 'descanso', 'sol', 'atencao');

-- Nulos nas metas que já existem (e nas gravadas por clientes antigos).
-- AlterTable
ALTER TABLE "goal" ADD COLUMN "icon" TEXT,
ADD COLUMN "color" "accent_color";

-- AlterTable
ALTER TABLE "habit" ADD COLUMN "goalId" TEXT;

-- CreateTable
CREATE TABLE "goal_chest" (
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "abertoEm" TIMESTAMPTZ(3) NOT NULL,
    "joias" INTEGER NOT NULL,

    CONSTRAINT "goal_chest_pkey" PRIMARY KEY ("userId","goalId")
);

-- CreateIndex
CREATE INDEX "habit_goalId_idx" ON "habit"("goalId");

-- AddForeignKey
ALTER TABLE "habit" ADD CONSTRAINT "habit_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_chest" ADD CONSTRAINT "goal_chest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_chest" ADD CONSTRAINT "goal_chest_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goal"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "goal_chest"
  ADD CONSTRAINT "goal_chest_joias_check" CHECK ("joias" >= 0);

-- As metas já concluídas tinham o prêmio dentro do saldo: o baú delas nasce aberto, para ninguém perder joias.
-- O valor é o da regra no dia da migração, de propósito fixo aqui.
INSERT INTO "goal_chest" ("userId", "goalId", "abertoEm", "joias")
SELECT "userId", "id", "completedAt", 10
FROM "goal"
WHERE "state" = 'concluida';
