import { BadRequestException } from "../http-exception";
import { D } from "./money-decimal";

const SATANG_CAP = 1;

export function roundMoney(n: number): number {
  return Number(new D(n).toDecimalPlaces(2, D.ROUND_HALF_UP));
}

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
