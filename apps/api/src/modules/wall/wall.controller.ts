import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { getRequiredParam } from "@/common/utils/params";
import { authenticate, requirePermission } from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { wallService } from "@/modules/wall/wall.service";
import {
  addCommentSchema,
  createPostSchema,
  reactSchema,
  updatePostSchema,
} from "@/modules/wall/wall.validation";

const router = Router();

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await wallService.listPosts(page, limit);
    res.json(result);
  }),
);

router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const input = createPostSchema.parse(req.body);
    const post = await wallService.createPost(req.user!.id, input);
    res.status(201).json({ data: post });
  }),
);

router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await wallService.getPostById(id);
    res.json({ data });
  }),
);

router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updatePostSchema.parse(req.body);
    const data = await wallService.updatePost(id, req.user!.id, input);
    res.json({ data });
  }),
);

router.put(
  "/:id/react",
  authenticate,
  requirePermission(PERMISSIONS.HOME_READ, PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = reactSchema.parse(req.body);
    const post = await wallService.react(id, req.user!.id, input);
    res.json({ data: post });
  }),
);

router.post(
  "/:id/comment",
  authenticate,
  requirePermission(PERMISSIONS.WALL_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = addCommentSchema.parse(req.body);
    const comment = await wallService.addComment(id, req.user!.id, input);
    res.status(201).json({ data: comment });
  }),
);

router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.WALL_DELETE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await wallService.deletePost(id);
    res.json({ data: { success: true } });
  }),
);

export default router;
