import { BadRequestException } from "@/common/exceptions/http-exception";

/**
 * Safely extract a string parameter from Express params.
 * Throws BadRequestException if the parameter is missing or invalid.
 */
export function getRequiredParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  if (typeof value !== "string" || !value) {
    throw new BadRequestException(`Missing required parameter: ${key}`);
  }
  return value;
}

/**
 * Safely extract an optional string parameter from Express params.
 * Returns undefined if the parameter is missing or an array.
 */
export function getOptionalParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (typeof value !== "string") {
    return undefined;
  }
  return value || undefined;
}
