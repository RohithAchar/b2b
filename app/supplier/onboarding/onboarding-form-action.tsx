"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { linkAccountToAllStores } from "@/lib/supplier/account-stores-actions";

const initialState: { ok: boolean; message: string } = {
  ok: false,
  message: "",
};

export function OnboardingFormAction() {
  const router = useRouter();
  const [state, action, pending] = useActionState(linkAccountToAllStores, initialState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Linking stores…" : "Link all stores"}
      </Button>
      {state.ok && (
        <>
          <p className="text-sm text-success">
            Stores linked. Opening your dashboard…
          </p>
          <Button
            type="button"
            onClick={() => router.push("/supplier/dashboard")}
            className="w-full"
          >
            Go to dashboard
          </Button>
        </>
      )}
      {!state.ok && state.message && (
        <p role="alert" className="text-sm text-destructive">{state.message}</p>
      )}
    </form>
  );
}
