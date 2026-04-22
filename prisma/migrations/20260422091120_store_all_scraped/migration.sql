-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "source" JSONB,
ADD COLUMN     "taxRate" DOUBLE PRECISION;
