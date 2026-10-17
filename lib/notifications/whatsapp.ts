// WhatsApp send provider. Notification-only: the website stays the system of
// record; this module just tries to hand a short factual message to WhatsApp
// and reports exactly what came back. Nothing is ever claimed as "sent"
// without a provider confirmation, and without credentials the mock
// provider records the attempt instead of touching any network.

export type WhatsAppSendResult =
  | { ok: true; provider: "mock" | "graph"; messageId: string }
  | { ok: false; provider: "mock" | "graph"; error: string };

const GRAPH_VERSION = "v21.0";
const SEND_TIMEOUT_MS = 10_000;

/** True only when both Graph API credentials are present server-side. */
export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

/** Digits-only Indian number for the Graph API `to` field. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1);
  return null;
}

/**
 * Best-effort send. Free-form outbound text on the WhatsApp Business API is
 * only delivered to users who have messaged first (or via approved templates)
 * — that deployment detail is between the operator and Meta; either way the
 * returned result is exactly what the provider said, never an assumption.
 */
export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const to = normalizePhone(phone);
  if (!to) {
    return { ok: false, provider: whatsappConfigured() ? "graph" : "mock", error: "Recipient number is not a valid Indian mobile." };
  }

  if (!whatsappConfigured()) {
    // Mock provider: record the attempt, touch no network, claim nothing.
    console.info(`[whatsapp:mock] to=+91${to} ${text}`);
    return { ok: true, provider: "mock", messageId: `mock-${Date.now()}` };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID!.trim()}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { preview_url: false, body: text },
        }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      return {
        ok: false,
        provider: "graph",
        error: body?.error?.message ?? `WhatsApp API responded ${response.status}.`,
      };
    }

    const body = (await response.json()) as { messages?: { id?: string }[] };
    const messageId = body.messages?.[0]?.id;
    if (!messageId) {
      return { ok: false, provider: "graph", error: "WhatsApp API returned no message id." };
    }
    return { ok: true, provider: "graph", messageId };
  } catch (error) {
    return {
      ok: false,
      provider: "graph",
      error: error instanceof Error ? error.message : "WhatsApp send failed.",
    };
  }
}
