import { Router } from "express";
import multer from "multer";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { getRequiredParam } from "@/common/utils/params";
import { authenticate, requireActive } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import {
  type BucketName,
  MULTIPART_UPLOAD_MAX_BYTES,
  resolveDisplayUrl,
  STORAGE_BUCKETS,
  uploadFile,
} from "@/infrastructure/storage/supabase-storage";
import { uploadsRepository } from "@/modules/uploads/uploads.repository";
import { uploadsService } from "@/modules/uploads/uploads.service";
import {
  listUploadsSchema,
  uploadBase64Schema,
} from "@/modules/uploads/uploads.validation";

const router = Router();

router.use(authenticate, requireActive);

const upload = multer({
  storage: multer.memoryStorage(),
  // Buffered ceiling — per-bucket limits in `uploadFile` enforce the real cap.
  limits: { fileSize: MULTIPART_UPLOAD_MAX_BYTES },
});

router.post(
  "/multipart",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    // All active users may upload — every module (expenses, messaging, wall
    // posts) routes through this endpoint. The auth gate is authenticate +
    // requireActive above; no per-module permission is enforced here by
    // design. Per-bucket MIME/size limits in uploadFile() still apply.
    const rawBucket = (req.body.bucket as string) || "uploads";
    const validBuckets = Object.values(STORAGE_BUCKETS) as string[];
    if (!validBuckets.includes(rawBucket)) {
      throw new BadRequestException(
        `Invalid bucket "${rawBucket}". Must be one of: ${validBuckets.join(", ")}`,
      );
    }
    const bucket = rawBucket as BucketName;

    const result = await uploadFile(bucket, req.user!.id, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    const record = await uploadsRepository.create({
      filename: file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_"),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: result.path,
      bucket: result.bucket,
      uploadedBy: req.user!.id,
      purpose: req.body.purpose,
      linkedTo: req.body.linkedTo,
      linkedId: req.body.linkedId,
    });

    // Private buckets reject direct fetches from the public URL — hand the
    // caller a freshly signed URL so the immediate preview renders instead
    // of showing Supabase's raw "Bucket not found" JSON in the iframe.
    const displayUrl = await resolveDisplayUrl(result.bucket, result.path);
    res.status(201).json({ data: { ...record, url: displayUrl } });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = uploadBase64Schema.parse(req.body);
    const result = await uploadsService.upload(req.user!.id, input);
    res.status(201).json({ data: result });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, limit } = listUploadsSchema.parse(req.query);
    const result = await uploadsService.list(req.user!.id, page, limit);
    res.json(result);
  }),
);

router.get(
  "/:id/signed-url",
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const result = await uploadsService.getSignedUrl(id, req.user!.id);
    res.json({ data: result });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await uploadsService.remove(id, req.user!.id);
    res.json({ message: "File deleted" });
  }),
);

export default router;
