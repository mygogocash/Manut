/** Prisma-compatible cuid-ish id for text PKs (benefits, etc.). */
export function createCuid(): string {
  const time = Date.now().toString(36);
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  let rand = "";
  for (const b of bytes) rand += (b % 36).toString(36);
  return `c${time}${rand}`;
}
