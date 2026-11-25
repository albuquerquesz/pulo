-- Spec 14: conquistas ganhas. Só cria uma tabela; nenhum dado existente muda.
-- CreateTable
CREATE TABLE "achievement" (
    "userId" TEXT NOT NULL,
    "achievement" TEXT NOT NULL,
    "conquistadaEm" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "achievement_pkey" PRIMARY KEY ("userId","achievement")
);

-- AddForeignKey
ALTER TABLE "achievement" ADD CONSTRAINT "achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
