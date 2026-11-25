-- Tarefas sem código: saem o número por pessoa e o contador que o gerava. As tarefas continuam como estão.
-- DropIndex
DROP INDEX "task_userId_number_key";

-- AlterTable (o CHECK "task_number_check" sai junto com a coluna)
ALTER TABLE "task" DROP COLUMN "number";

-- DropTable
DROP TABLE "task_counter";
