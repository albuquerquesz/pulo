-- Spec 31: decoração por cômodo. Só acrescenta; as decorações existentes ficam no quarto.
-- AlterTable
ALTER TABLE "room_placement" ADD COLUMN "comodo" TEXT NOT NULL DEFAULT 'quarto';
