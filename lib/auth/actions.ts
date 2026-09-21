"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { buildAuthCallbackUrl } from "@/lib/auth/origin";
import { getSafeNextPath, LOGIN_PATH } from "@/lib/auth/paths";

const emailSchema = z.object({
  email: z.email("Enter a valid email address."),
});

const verifySchema = z.object({
  email: z.email("Enter a valid email address."),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type AuthActionState = {
  ok: boolean;
  message: string;
};

export async function requestOtp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState | never> {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });
  const next = getSafeNextPath(formData.get("next")?.toString());

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createClient();
  const emailRedirectTo = buildAuthCallbackUrl(await headers(), next);
  if (!emailRedirectTo) {
    redirect("/auth/error?reason=redirect-unresolved");
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      // Magic-link clicks land here too, so the callback must be allowlisted
      // in Supabase → URL Configuration → Redirect URLs.
      emailRedirectTo,
    },
  });

  if (error) {
    console.error("requestOtp failed:", error.code, error.status, error.message);
    // Built-in email provider allows 2 emails/hour; per-address resends are
    // also throttled. Surface which one so the user knows to wait.
    if (
      error.code === "over_email_send_rate_limit" ||
      error.status === 429 ||
      /rate limit/i.test(error.message)
    ) {
      return {
        ok: false,
        message:
          "Email limit reached (2 per hour on the built-in sender). Wait a while and try again.",
      };
    }
    return { ok: false, message: "Could not send the code. Try again." };
  }

  const params = new URLSearchParams({ email: parsed.data.email, next });
  redirect(`/auth/verify?${params.toString()}`);
}

export async function verifyOtp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState | never> {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });
  const next = getSafeNextPath(formData.get("next")?.toString());

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid code." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return { ok: false, message: "That code did not work. Check it and try again." };
  }

  await ensureProfile(supabase);
  redirect(next);
}

export async function signInWithGoogle(formData: FormData): Promise<never> {
  const next = getSafeNextPath(formData.get("next")?.toString());
  const redirectTo = buildAuthCallbackUrl(await headers(), next);
  const supabase = await createClient();

  if (!redirectTo) {
    redirect("/auth/error?reason=redirect-unresolved");
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    redirect("/auth/error?reason=google-not-configured");
  }

  redirect(data.url);
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
