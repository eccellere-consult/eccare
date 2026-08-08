-- Add an optional house/flat number to Marketplace and Jobs/Resources listings so
-- buyers/helpers know where to go — targeted migration (not `prisma db push`).

ALTER TABLE `MarketplaceListing`
  ADD COLUMN `houseNumber` VARCHAR(191) NULL;

ALTER TABLE `CommunityJobPosting`
  ADD COLUMN `houseNumber` VARCHAR(191) NULL;
