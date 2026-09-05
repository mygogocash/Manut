import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { PERMISSIONS } from "@nexora/contracts";
import {
  createExchangeRateSchema,
  listExchangeRatesSchema,
  updateExchangeRateSchema,
} from "@nexora/contracts/modules/exchange-rates/exchange-rates.validation";
import { exchangeRatesService } from "@nexora/core";
import type { AppEnv } from "../lib/context";
import { requirePermission } from "../middleware/rbac";

export const exchangeRates = new Hono<AppEnv>()
  .get(
    "/",
    requirePermission(
      PERMISSIONS.ACCOUNTING_READ,
      PERMISSIONS.ACCOUNTING_ADMIN,
      PERMISSIONS.CRM_READ,
    ),
    zValidator("query", listExchangeRatesSchema),
    async (c) => c.json(await exchangeRatesService.list(c.var.db, c.req.valid("query"))),
  )
  .post(
    "/",
    requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
    zValidator("json", createExchangeRateSchema),
    async (c) => {
      const data = await exchangeRatesService.create(c.var.db, c.req.valid("json"));
      return c.json({ data }, 201);
    },
  )
  .post("/sync-bot", requirePermission(PERMISSIONS.ACCOUNTING_ADMIN), async (c) => {
    const data = await exchangeRatesService.syncBotRates(
      c.var.db,
      c.env as exchangeRatesService.BotFxEnv,
    );
    return c.json({ data });
  })
  .put(
    "/:id",
    requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
    zValidator("json", updateExchangeRateSchema),
    async (c) => {
      const data = await exchangeRatesService.update(c.var.db, c.req.param("id"), c.req.valid("json"));
      return c.json({ data });
    },
  )
  .delete("/:id", requirePermission(PERMISSIONS.ACCOUNTING_ADMIN), async (c) => {
    await exchangeRatesService.remove(c.var.db, c.req.param("id"));
    return c.json({ data: { success: true } });
  });
