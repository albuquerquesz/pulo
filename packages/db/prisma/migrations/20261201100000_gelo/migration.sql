-- Spec 29: gelo da sequência. Só acrescenta; nenhum dado existente é apagado.
-- AlterEnum
ALTER TYPE "purchase_kind" ADD VALUE 'gelo';

-- CreateTable
CREATE TABLE "freeze_use" (
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "vistoEm" TIMESTAMPTZ(3),

    CONSTRAINT "freeze_use_pkey" PRIMARY KEY ("userId","date")
);

-- AddForeignKey
ALTER TABLE "freeze_use" ADD CONSTRAINT "freeze_use_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "mascot_state" ADD COLUMN "geloResolvidoAte" DATE;

-- Quem já tem conta começa resolvido até ontem: ninguém gasta gelo por dias antigos.
UPDATE "mascot_state" SET "geloResolvidoAte" = CURRENT_DATE - 1;
