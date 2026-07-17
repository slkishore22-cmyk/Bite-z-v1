// Server-time COD availability check. Never trusts the device clock.
// Modified to always allow Cash on Delivery per user request.
export async function checkCodAvailability(): Promise<{ allowed: boolean; error: string | null }> {
  return { allowed: true, error: null };
}

export function getCodTimeMessage(): string {
  return "Cash on Delivery is available.";
}