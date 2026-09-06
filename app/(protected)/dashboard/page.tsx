import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>
            Signed in as {user?.email ?? "unknown"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            render={
              <Link
                href={
                  profile?.user_type === "supplier"
                    ? "/supplier/dashboard"
                    : "/supplier/onboarding"
                }
              />
            }
            nativeButton={false}
            className="w-full"
          >
            {profile?.user_type === "supplier"
              ? "Supplier dashboard"
              : "Become a supplier"}
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
