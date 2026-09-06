"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestOtp, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { ok: false, message: "" };

export function RequestOtpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(requestOtp, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
        />
      </div>
      <input type="hidden" name="next" value={next} />
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Continue with email"}
      </Button>
    </form>
  );
}
