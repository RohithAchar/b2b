import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/profile";
import { getSafeNextPath } from "@/lib/auth/paths";

const TOKEN_HASH_TYPES: readonly EmailOtpType[] = [
  "magiclink",
  "recovery",
  "email_change",
  "email",
  "signup",
  "invite",
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = getSafeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  // PKCE code flow (Google OAuth).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect("/auth/error?reason=exchange-failed");
    }
    await ensureProfile(supabase);
    redirect(next);
  }

  // Magic-link / recovery link flow (?token_hash=&type=).
  if (token_hash && type && TOKEN_HASH_TYPES.includes(type as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (error) {
      redirect("/auth/error?reason=exchange-failed");
    }
    await ensureProfile(supabase);
    redirect(next);
  }

  redirect("/auth/error?reason=missing-code");
}
