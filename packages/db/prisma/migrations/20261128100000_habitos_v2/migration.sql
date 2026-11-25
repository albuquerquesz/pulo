-- Spec 17: hábitos com ícone, cor, período, lembrete e estado; ícone no bloco da rotina. Nenhum dado é apagado.
-- CreateEnum
CREATE TYPE "habit_state" AS ENUM ('ativo', 'pausado', 'arquivado');
CREATE TYPE "habit_period" AS ENUM ('manha', 'tarde', 'noite');

-- AlterTable
ALTER TABLE "habit" ADD COLUMN "icon" TEXT,
ADD COLUMN "color" "accent_color",
ADD COLUMN "period" "habit_period",
ADD COLUMN "reminderMinutes" SMALLINT,
ADD COLUMN "reminderOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "state" "habit_state" NOT NULL DEFAULT 'ativo',
ADD COLUMN "createdAt" TIMESTAMPTZ(3);

-- Os hábitos que já existem ficam sem data de criação (não se sabe); os novos recebem a hora do banco.
ALTER TABLE "habit" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "routine_block" ADD COLUMN "icon" TEXT;

UPDATE "habit" SET "state" = 'arquivado' WHERE NOT "active";

-- DropIndex
DROP INDEX "habit_userId_active_idx";

-- CreateIndex
CREATE INDEX "habit_userId_state_idx" ON "habit"("userId", "state");

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "habit"
  ADD CONSTRAINT "habit_reminderMinutes_check" CHECK ("reminderMinutes" BETWEEN 0 AND 1439);

-- A coluna antiga "active" fica só para a transição: a API publicada ainda a lê e grava enquanto o deploy não termina
-- (e se for preciso voltar a versão). O gatilho a mantém igual a "state" = 'ativo'. Uma migração futura apaga os dois.
CREATE FUNCTION "habit_sync_active"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW."active" AND NEW."state" = 'ativo' THEN
      NEW."state" := 'arquivado';
    END IF;
  ELSIF NEW."state" = OLD."state" AND NEW."active" IS DISTINCT FROM OLD."active" THEN
    NEW."state" := CASE WHEN NEW."active" THEN 'ativo' ELSE 'arquivado' END::"habit_state";
  END IF;
  NEW."active" := NEW."state" = 'ativo';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "habit_sync_active" BEFORE INSERT OR UPDATE ON "habit"
  FOR EACH ROW EXECUTE FUNCTION "habit_sync_active"();
