-- AlterTable
ALTER TABLE "RestaurantMember" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateIndex
CREATE INDEX "RestaurantMember_restaurantId_status_idx" ON "RestaurantMember"("restaurantId", "status");
