import { roundMoney } from "@/modules/accounting/rounding";

/** Services / collection basis: recognise output VAT proportional to cash
 *  collected versus invoice gross (incl VAT). */
export function recognisedOutputVat(opts: {
  invoiceGross: number;
  invoiceVat: number;
  collected: number;
  previouslyRecognised?: number;
}): number {
  if (opts.invoiceGross <= 0 || opts.invoiceVat === 0) return 0;
  const ratio = Math.min(1, Math.max(0, opts.collected / opts.invoiceGross));
  const target = roundMoney(opts.invoiceVat * ratio);
  const already = roundMoney(opts.previouslyRecognised ?? 0);
  return roundMoney(Math.max(0, target - already));
}
