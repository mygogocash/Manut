/** Lightweight decimal for edge-safe money math (replaces Prisma.Decimal in pure helpers). */
export class Decimal {
  static readonly ROUND_HALF_UP = 4;
  private readonly value: number;

  constructor(v: number | string | Decimal) {
    this.value = v instanceof Decimal ? v.value : Number(v);
    if (!Number.isFinite(this.value)) throw new Error("Invalid decimal");
  }

  isNegative(): boolean {
    return this.value < 0;
  }

  isZero(): boolean {
    return this.value === 0;
  }

  plus(other: Decimal | number | string): Decimal {
    return new Decimal(this.value + new Decimal(other).value);
  }

  minus(other: Decimal | number | string): Decimal {
    return new Decimal(this.value - new Decimal(other).value);
  }

  times(other: Decimal | number | string): Decimal {
    return new Decimal(this.value * new Decimal(other).value);
  }

  div(other: Decimal | number | string): Decimal {
    const d = new Decimal(other).value;
    if (d === 0) throw new Error("Division by zero");
    return new Decimal(this.value / d);
  }

  equals(other: Decimal | number | string): boolean {
    return this.value === new Decimal(other).value;
  }

  toDecimalPlaces(dp: number, _mode?: number): Decimal {
    const f = 10 ** dp;
    return new Decimal(Math.round(this.value * f) / f);
  }

  toFixed(dp: number): string {
    return this.value.toFixed(dp);
  }

  toString(): string {
    return String(this.value);
  }

  static max(a: Decimal, b: Decimal): Decimal {
    return a.value >= b.value ? a : b;
  }

  static min(a: Decimal, b: Decimal): Decimal {
    return a.value <= b.value ? a : b;
  }
}

export const D = Decimal;
