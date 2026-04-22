-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "bagFee" JSONB,
ADD COLUMN     "googleMapsUrl" TEXT,
ADD COLUMN     "inactive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "landingUrl" TEXT,
ADD COLUMN     "minOrder" INTEGER,
ADD COLUMN     "orderOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "source" JSONB,
ADD COLUMN     "sourceScrapedAt" TIMESTAMP(3),
ADD COLUMN     "tipValues" JSONB,
ADD COLUMN     "waitTimeMinutes" INTEGER,
ADD COLUMN     "welcomeMessageBody" TEXT,
ADD COLUMN     "welcomeMessageTitle" TEXT;
