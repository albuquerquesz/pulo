-- Spec 20: tarefas em quadro. Só cria tipos e tabelas novas; nenhuma linha existente muda.
-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('ideias', 'afazer', 'fazendo', 'feito');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('normal', 'alta');

-- CreateEnum
CREATE TYPE "task_event_kind" AS ENUM ('criada', 'status', 'prioridade', 'prazo');

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "task_status" NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "priority" "task_priority" NOT NULL,
    "dueDate" DATE,
    "tags" TEXT[],
    "goalId" TEXT,
    "pomodorosEstimated" SMALLINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_subtask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "task_subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" "task_event_kind" NOT NULL,
    "de" TEXT,
    "para" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "seq" SERIAL NOT NULL,

    CONSTRAINT "task_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_counter" (
    "userId" TEXT NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "task_counter_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "task_goalId_idx" ON "task"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX "task_id_userId_key" ON "task"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_userId_number_key" ON "task"("userId", "number");

-- CreateIndex
CREATE INDEX "task_subtask_userId_taskId_idx" ON "task_subtask"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "task_subtask_id_userId_key" ON "task_subtask"("id", "userId");

-- CreateIndex
CREATE INDEX "task_comment_userId_taskId_idx" ON "task_comment"("userId", "taskId");

-- CreateIndex
CREATE INDEX "task_event_userId_taskId_idx" ON "task_event"("userId", "taskId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_subtask" ADD CONSTRAINT "task_subtask_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "task"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "task"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_taskId_userId_fkey" FOREIGN KEY ("taskId", "userId") REFERENCES "task"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_counter" ADD CONSTRAINT "task_counter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrições de domínio que o Prisma não expressa.
ALTER TABLE "task"
  ADD CONSTRAINT "task_number_check" CHECK ("number" >= 1),
  ADD CONSTRAINT "task_completed_check" CHECK (("status" = 'feito') = ("completedAt" IS NOT NULL)),
  ADD CONSTRAINT "task_pomodoros_check" CHECK ("pomodorosEstimated" >= 0);
ALTER TABLE "task_counter" ADD CONSTRAINT "task_counter_last_check" CHECK ("last" >= 1);
