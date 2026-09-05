-- DropForeignKey
ALTER TABLE "wiki_pages" DROP CONSTRAINT "wiki_pages_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "wiki_pages" DROP CONSTRAINT "wiki_pages_updated_by_id_fkey";

-- AlterTable
ALTER TABLE "wiki_pages" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
