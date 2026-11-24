-- Ilha do sapo: compras de áreas e enfeites com moscas. Uma por item e pessoa; o saldo não é gravado.
-- CreateTable
CREATE TABLE "island_purchase" (
    "userId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "island_purchase_pkey" PRIMARY KEY ("userId","item")
);

-- AddForeignKey
ALTER TABLE "island_purchase" ADD CONSTRAINT "island_purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "island_purchase"
  ADD CONSTRAINT "island_purchase_cost_check" CHECK ("cost" >= 0);
