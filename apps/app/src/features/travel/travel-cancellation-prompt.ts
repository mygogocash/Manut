import type { TravelRequest } from "@manut/app-core";

/**
 * Confirm copy for cancelling a travel request.
 * Only draft/pending requests are cancelable in this slice.
 *
 * TODO(you): tune the tone — keep it short, mention the trip route and dates,
 * and avoid promising refunds (travel cancel does not reverse approved trips).
 */
export function travelCancellationPrompt(request: TravelRequest): string {
  const route = `${request.origin ?? "Origin"} → ${request.destination}`;
  const dates = `${request.departureDate} – ${request.returnDate}`;
  // Placeholder kept intentional for Wave 2 product copy review.
  return `Cancel travel ${request.requestCode} (${route}, ${dates})?`;
}
