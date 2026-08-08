-- Health Essentials: User quick-reference fields + HealthCoverageItem table
-- Targeted migration (not `prisma db push`) to avoid dropping other unmerged
-- branches' tables. Index/constraint names use the exact PascalCase Prisma
-- model name (not the lowercased MySQL table name) to avoid the MariaDB
-- case-insensitive index-name collision found earlier this session.

ALTER TABLE `User`
  ADD COLUMN `familyDoctorName` VARCHAR(191) NULL,
  ADD COLUMN `familyDoctorPhone` VARCHAR(191) NULL,
  ADD COLUMN `preferredHospitalName` VARCHAR(191) NULL,
  ADD COLUMN `preferredHospitalLocation` VARCHAR(191) NULL;

CREATE TABLE `HealthCoverageItem` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `addedById` VARCHAR(191) NOT NULL,
  `type` ENUM('hospital_plan', 'insurance_plan', 'diagnostics', 'wearable_gadget') NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NULL,
  `policyNumber` VARCHAR(191) NULL,
  `filePath` VARCHAR(191) NULL,
  `fileName` VARCHAR(191) NULL,
  `fileType` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `HealthCoverageItem_userId_type_idx` (`userId`, `type`),
  INDEX `HealthCoverageItem_addedById_idx` (`addedById`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `HealthCoverageItem`
  ADD CONSTRAINT `HealthCoverageItem_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `HealthCoverageItem_addedById_fkey`
    FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
