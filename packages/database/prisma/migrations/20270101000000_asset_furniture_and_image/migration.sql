-- Office assets: furniture metadata, and a photo for any asset.
--
-- FURNITURE
--
-- "furniture" was already an accepted asset type, but the form had nothing to
-- say about it — it fell through to the generic fieldset alongside "other".
-- Every category-specific field the table carried was a HARDWARE field
-- (manufacturer, model, operating system, support link), none of which means
-- anything for a desk. These are the fields that actually identify one.
--
-- `dimensions` is free text rather than three numeric columns on purpose:
-- catalogues quote sizes in incompatible forms ("W120 x D60 x H75 cm", "Ø90 cm",
-- "2-seater"), and forcing them into length/width/height silently loses every
-- shape that is not a box.
--
-- `condition` is a plain string, validated in the application. A DB enum would
-- mean a migration every time facilities wanted another rung on the ladder.
--
-- IMAGE
--
-- Applies to every category, not just furniture. The column is generic and a
-- photo is as useful for identifying a monitor on a shelf as a chair in a room.
--
-- Stored as a URL into the PUBLIC `uploads` bucket. A private bucket would need
-- a signed URL minted per asset on every list render — one request per row — for
-- a picture of a chair.
--
-- Idempotent: every column is added IF NOT EXISTS and nullable, so existing
-- assets are untouched and the form behaves exactly as before until someone
-- fills one in.

ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "material" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "dimensions" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "condition" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "location_detail" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "warranty_until" DATE;
