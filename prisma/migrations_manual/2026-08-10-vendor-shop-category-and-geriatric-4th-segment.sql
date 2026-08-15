-- Adds the structured Local Vendors (shop) category tag and expands Geriatric Care
-- into a 4th elder-care segment (doctor home visits, Ayurveda, hospitals, ambulance)
-- — targeted migration (not `prisma db push`), same pattern as the other files here.

ALTER TABLE `LocalListing`
  ADD COLUMN `shopCategory` ENUM('medical_store','supermarket','electrical_supplies','hardware_store','stationery','bakery','other') NULL;

CREATE INDEX `LocalListing_neighborhoodId_shopCategory_idx` ON `LocalListing`(`neighborhoodId`, `shopCategory`);

-- Existing rows keep their current category value — all seven original values remain
-- valid members of the expanded enum, so this is backward-compatible.
ALTER TABLE `GeriatricCareListing`
  MODIFY COLUMN `category` ENUM('self_help_group','ngo','palliative_care','physiotherapy','massage','yoga','meditation','doctor_home_visit','ayurveda','hospital','ambulance') NOT NULL;
