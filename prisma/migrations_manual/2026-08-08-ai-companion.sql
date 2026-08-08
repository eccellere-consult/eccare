-- AI Companion: MoodLog table for daily elder mood check-ins.
-- Targeted migration (not `prisma db push`) to avoid dropping other unmerged
-- branches' tables. Index name uses the exact PascalCase Prisma model name.

CREATE TABLE `MoodLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `mood` ENUM('great', 'good', 'okay', 'low', 'not_well') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `MoodLog_userId_createdAt_idx` (`userId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MoodLog`
  ADD CONSTRAINT `MoodLog_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
