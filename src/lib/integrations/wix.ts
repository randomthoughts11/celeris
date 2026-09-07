/**
 * Wix Bookings + site helpers. Graceful when WIX_API_KEY / WIX_SITE_ID missing.
 */

const WIX_API = "https://www.wixapis.com";

export function wixConfigured(): boolean {
  return Boolean(process.env.WIX_API_KEY && process.env.WIX_SITE_ID);
}

export function wixStatusMessage(): string {
  if (!process.env.WIX_API_KEY) return "Add WIX_API_KEY in .env";
  if (!process.env.WIX_SITE_ID) return "Add WIX_SITE_ID in .env";
  return "Connected";
}

async function wixFetch(path: string, init?: RequestInit) {
  const key = process.env.WIX_API_KEY!;
  const siteId = process.env.WIX_SITE_ID!;
  return fetch(`${WIX_API}${path}`, {
    ...init,
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
      "wix-site-id": siteId,
      ...(init?.headers ?? {}),
    },
  });
}

export async function fetchWixAvailability(serviceId?: string): Promise<{
  ok: boolean;
  slots: Array<{ start: string; end: string }>;
  error?: string;
}> {
  if (!wixConfigured()) {
    return { ok: false, slots: [], error: wixStatusMessage() };
  }
  try {
    // Bookings Calendar query — soft-fail to empty if schema differs
    const res = await wixFetch("/bookings/v2/availability/query", {
      method: "POST",
      body: JSON.stringify({
        query: {
          filter: serviceId ? { serviceId } : {},
        },
      }),
    });
    if (!res.ok) {
      return { ok: false, slots: [], error: `Wix ${res.status}` };
    }
    const data = (await res.json()) as {
      availabilityEntries?: Array<{ slot?: { startDate?: string; endDate?: string } }>;
    };
    const slots = (data.availabilityEntries ?? [])
      .map((e) => ({
        start: e.slot?.startDate ?? "",
        end: e.slot?.endDate ?? "",
      }))
      .filter((s) => s.start);
    return { ok: true, slots };
  } catch (e) {
    return {
      ok: false,
      slots: [],
      error: e instanceof Error ? e.message : "Wix request failed",
    };
  }
}

export function buildBookingLink(opts?: {
  serviceId?: string;
  staffId?: string;
}): string {
  const siteId = process.env.WIX_SITE_ID;
  if (!siteId) return "";
  const base = `https://www.wix.com/bookings/widget/schedule?siteId=${siteId}`;
  if (opts?.serviceId) return `${base}&serviceId=${opts.serviceId}`;
  return base;
}

export function buildPaymentLink(amount: number, currency = "INR"): string {
  // ponytail: use Wix Payments / custom checkout URL when configured; else placeholder
  const siteId = process.env.WIX_SITE_ID;
  if (!siteId) return "";
  return `https://www.wix.com/payment-link?siteId=${siteId}&amount=${amount}&currency=${currency}`;
}
