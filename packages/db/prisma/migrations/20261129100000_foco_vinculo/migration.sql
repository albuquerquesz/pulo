-- Spec 19: intenção e vínculo opcional no foco. Só acrescenta; as sessões que já existem ficam sem os dois.
-- AlterTable
ALTER TABLE "focus_session" ADD COLUMN "intention" TEXT,
ADD COLUMN "habitId" TEXT,
ADD COLUMN "goalId" TEXT,
ADD COLUMN "taskId" TEXT;

-- CreateIndex
CREATE INDEX "focus_session_habitId_idx" ON "focus_session"("habitId");
CREATE INDEX "focus_session_goalId_idx" ON "focus_session"("goalId");
CREATE INDEX "focus_session_taskId_idx" ON "focus_session"("taskId");

-- AddForeignKey
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "focus_session" ADD CONSTRAINT "focus_session_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "focus_session"
  ADD CONSTRAINT "focus_session_one_target_check" CHECK (num_nonnulls("habitId", "goalId", "taskId") <= 1);
