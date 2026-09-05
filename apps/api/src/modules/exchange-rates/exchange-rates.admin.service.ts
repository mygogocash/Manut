import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateExchangeRateInput,
  ListExchangeRatesQuery,
  UpdateExchangeRateInput,
} from "@/modules/exchange-rates/exchange-rates.validation";

// PRD §11.5 follow-up — admin CRUD service for the finance
// exchange_rates table. Kept separate from the lookup helper
// (createExchangeRateService) so unit tests for the lookup don't pull
// in the admin path and vice-versa.

export class ExchangeRateAdminService {
  async list(query: ListExchangeRatesQuery) {
    const where: Record<string, unknown> = {};
    if (query.baseCurrency) where.baseCurrency = query.baseCurrency;
    if (query.currency) where.currency = query.currency;

    const rows = await prisma.exchangeRate.findMany({
      where,
      orderBy: [
        { baseCurrency: "asc" },
        { currency: "asc" },
        { effectiveDate: "desc" },
      ],
    });

    if (!query.latestOnly) return rows;

    // De-dupe to one row per (base, currency) pair. Postgres returned
    // each pair sorted by effectiveDate desc, so the first occurrence
    // wins.
    const seen = new Set<string>();
    const latest = [] as typeof rows;
    for (const r of rows) {
      const key = `${r.baseCurrency}-${r.currency}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latest.push(r);
    }
    return latest;
  }

  async create(input: CreateExchangeRateInput) {
    const dup = await prisma.exchangeRate.findFirst({
      where: {
        baseCurrency: input.baseCurrency,
        currency: input.currency,
        effectiveDate: new Date(input.effectiveDate),
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `A rate for ${input.baseCurrency} → ${input.currency} on ${input.effectiveDate} already exists.`,
      );
    }
    return prisma.exchangeRate.create({
      data: {
        baseCurrency: input.baseCurrency,
        currency: input.currency,
        rate: input.rate,
        effectiveDate: new Date(input.effectiveDate),
        source: input.source ?? "manual",
      },
    });
  }

  async update(id: string, input: UpdateExchangeRateInput) {
    const existing = await prisma.exchangeRate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Exchange rate not found");
    }
    return prisma.exchangeRate.update({
      where: { id },
      data: {
        ...(input.rate !== undefined && { rate: input.rate }),
        ...(input.source !== undefined && { source: input.source }),
      },
    });
  }

  async delete(id: string) {
    const existing = await prisma.exchangeRate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException("Exchange rate not found");
    }
    await prisma.exchangeRate.delete({ where: { id } });
  }
}

export const exchangeRateAdminService = new ExchangeRateAdminService();
