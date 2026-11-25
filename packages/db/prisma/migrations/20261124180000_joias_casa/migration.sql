-- Spec 18: moscas viram joias; casa e quarto no lugar das áreas da ilha. Nenhuma compra é apagada.
-- CreateEnum
CREATE TYPE "purchase_kind" AS ENUM ('casa', 'decoracao', 'antiga');

-- As compras que já existem são da ilha antiga: ficam gravadas, mas deixam de gastar joias (o valor volta).
-- O padrão continua 'antiga' para a API antiga, que não manda a coluna.
-- AlterTable
ALTER TABLE "island_purchase" ADD COLUMN "kind" "purchase_kind" NOT NULL DEFAULT 'antiga';

-- CreateTable
CREATE TABLE "room_placement" (
    "userId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "x" SMALLINT NOT NULL,
    "y" SMALLINT NOT NULL,
    "rotation" SMALLINT NOT NULL,

    CONSTRAINT "room_placement_pkey" PRIMARY KEY ("userId","item")
);

-- CreateTable
CREATE TABLE "joia_credit" (
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "joia_credit_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "room_placement" ADD CONSTRAINT "room_placement_userId_item_fkey" FOREIGN KEY ("userId", "item") REFERENCES "island_purchase"("userId", "item") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joia_credit" ADD CONSTRAINT "joia_credit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "room_placement"
  ADD CONSTRAINT "room_placement_position_check" CHECK ("x" >= 0 AND "y" >= 0),
  ADD CONSTRAINT "room_placement_rotation_check" CHECK ("rotation" IN (0, 90, 180, 270));
ALTER TABLE "joia_credit"
  ADD CONSTRAINT "joia_credit_amount_check" CHECK ("amount" > 0);

-- O foco deixa de valer um tanto fixo (3 por sessão de cuidado) e passa a valer 1 joia a cada 5 minutos focados
-- (até o planejado). Quem ganharia menos pela regra nova recebe a diferença como ganho histórico.
-- Os números são os das regras no dia da migração, de propósito fixos aqui.
INSERT INTO "joia_credit" ("userId", "amount")
SELECT "userId", SUM("antes") - SUM("depois")
FROM (
  SELECT
    "userId",
    CASE WHEN "state" = 'concluida' OR "efetivo" >= "plannedMinutes" * 60000 * 0.5 THEN 3 ELSE 0 END AS "antes",
    FLOOR(LEAST("efetivo", "plannedMinutes" * 60000) / 300000) AS "depois"
  FROM (
    SELECT
      "userId",
      "state",
      "plannedMinutes",
      GREATEST(0, ROUND(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) * 1000) - "pausedMs") AS "efetivo"
    FROM "focus_session"
    WHERE "state" <> 'em_andamento'
  ) AS "sessoes"
) AS "valores"
GROUP BY "userId"
HAVING SUM("antes") > SUM("depois");
