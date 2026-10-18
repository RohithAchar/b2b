// WhatsApp send provider. Notification-only: the website stays the system of
// record; this module just tries to hand a short factual message to WhatsApp
// and reports exactly what came back. Nothing is ever claimed as "sent"
// without a provider confirmation, and without credentials the mock
// provider records the attempt instead of touching any network.
//
// Delivery goes through a self-hosted OpenWA gateway (https://www.open-wa.org)
// linked to a WhatsApp account. OpenWA speaks plain HTTP and expects TLS to be
// terminated in front of it; it authenticates every call with an X-API-Key.

export type WhatsAppSendResult =
  | { ok: true; provider: "mock" | "openwa"; messageId: string }
  | { ok: false; provider: "mock" | "openwa"; error: string };

// OpenWA confirms sends quickly in steady state (~1-2s), but a send that
// follows an idle period re-establishes the underlying WhatsApp socket and can
// block well past 10s before returning. Give the cold path room to finish
// rather than abandoning a message that would have gone out.
const SEND_TIMEOUT_MS = 30_000;

/** True only when every OpenWA credential is present server-side. */
export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.OPENWA_API_URL?.trim() &&
      process.env.OPENWA_API_KEY?.trim() &&
      process.env.OPENWA_SESSION_ID?.trim(),
  );
}

/** Digits-only Indian number for the OpenWA `chatId` field. */
export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2);
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1);
  return null;
}

/** OpenWA chat id for an Indian mobile: `91XXXXXXXXXX@c.us`. */
export function openwaChatId(phone: string): string | null {
  const to = normalizePhone(phone);
  return to ? `91${to}@c.us` : null;
}

/**
 * Best-effort send. OpenWA is a linked WhatsApp account rather than the
 * official Business API, so free-form text reaches any number — but that is
 * also why the operator must keep sends transactional, not promotional. Either
 * way the returned result is exactly what the gateway said, never an
 * assumption.
 */
export async function sendWhatsAppMessage(
  phone: string,
  text: string,
): Promise<WhatsAppSendResult> {
  const provider: "mock" | "openwa" = whatsappConfigured() ? "openwa" : "mock";
  const chatId = openwaChatId(phone);
  if (!chatId) {
    return { ok: false, provider, error: "Recipient number is not a valid Indian mobile." };
  }

  if (provider === "mock") {
    // Mock provider: record the attempt, touch no network, claim nothing.
    console.info(`[whatsapp:mock] to=${chatId} ${text}`);
    return { ok: true, provider: "mock", messageId: `mock-${Date.now()}` };
  }

  const baseUrl = process.env.OPENWA_API_URL!.trim().replace(/\/+$/, "");
  const sessionId = encodeURIComponent(process.env.OPENWA_SESSION_ID!.trim());

  try {
    const response = await fetch(
      `${baseUrl}/sessions/${sessionId}/messages/send-text`,
      {
        method: "POST",
        headers: {
          "X-API-Key": process.env.OPENWA_API_KEY!.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chatId, text }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      // NestJS error envelope: `message` is a string, or an array of
      // field-level strings when validation detail is enabled.
      const body = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;
      const detail = Array.isArray(body?.message)
        ? body.message.join("; ")
        : body?.message;
      return {
        ok: false,
        provider: "openwa",
        error: detail?.trim() || `OpenWA responded ${response.status}.`,
      };
    }

    const body = (await response.json()) as { messageId?: string };
    if (!body.messageId) {
      return { ok: false, provider: "openwa", error: "OpenWA returned no message id." };
    }
    return { ok: true, provider: "openwa", messageId: body.messageId };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return {
        ok: false,
        provider: "openwa",
        error: `OpenWA did not confirm within ${SEND_TIMEOUT_MS / 1000}s; the message may still have been delivered.`,
      };
    }
    return {
      ok: false,
      provider: "openwa",
      error: error instanceof Error ? error.message : "WhatsApp send failed.",
    };
  }
}
