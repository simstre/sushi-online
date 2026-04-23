-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "modifiers" JSONB;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "modifiers" JSONB;
