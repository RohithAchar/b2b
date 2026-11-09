import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAccountStores } from "@/lib/supplier/account-stores";
import { OnboardingFormAction } from "./onboarding-form-action";

export const metadata: Metadata = {
  title: "Set up your stores",
  description: "Link your account to the stores you want to manage.",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect("/auth/login");
  }

  // Buyers have no supplier onboarding.
  const [{ data: profile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (profile?.user_type === "buyer") {
    redirect("/");
  }

  // Already linked to stores: show a message with a link to the dashboard
  // instead of auto-redirecting, so the page stays reachable.
  const accountStores = await getAccountStores();
  if (accountStores.length > 0) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Stores already linked</CardTitle>
            <CardDescription>
              Your account is already linked to all active stores. You can open
              the dashboard to manage them.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex justify-center">
              <Button
                render={<Link href="/supplier/dashboard" />}
                nativeButton={false}
              >
                Go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Set up your stores</CardTitle>
          <CardDescription>
            Link your account to all active stores so you can manage them from
            one dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Once linked, use the store switcher in the dashboard to move
            between stores. D2H Core is fully available; the other stores show
            a &ldquo;Coming soon&rdquo; state until their dashboards are ready.
          </p>
          <OnboardingFormAction />
        </CardContent>
      </Card>
    </div>
  );
}
