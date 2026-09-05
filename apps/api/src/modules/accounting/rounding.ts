import { Prisma } from "@nexora/database";

import { BadRequestException } from "@/common/exceptions/http-exception";

const D = Prisma.Decimal;
const SATANG_CAP = 1;

export function roundMoney(n: number): number {
  return Number(new D(n).toDecimalPlaces(2, D.ROUND_HALF_UP));
}

/** User satang tweak ±1.00 THB. Does not alter tax base — callers apply
 *  `rounding` to a rounding-difference account only. */
export function applySatangAdjustment(
  calculatedTotal: number,
  userTotal: number,
): { total: number; rounding: number } {
  const calculated = roundMoney(calculatedTotal);
  const user = roundMoney(userTotal);
  const rounding = roundMoney(user - calculated);
  if (Math.abs(rounding) > SATANG_CAP) {
    throw new BadRequestException(
      `Satang adjustment ${rounding.toFixed(2)} exceeds ±${SATANG_CAP.toFixed(2)} THB`,
    );
  }
  return { total: user, rounding };
}
