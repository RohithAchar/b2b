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

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>B2B Marketplace</CardTitle>
          <CardDescription>
            {user
              ? profile?.user_type === "admin"
                ? `Signed in as ${user.email}. Supplier applications are waiting in your review desk.`
                : profile?.user_type === "supplier"
                  ? `Signed in as ${user.email}. Manage your business from your dashboard.`
                  : `Signed in as ${user.email}. Sell to verified buyers — apply as a supplier.`
              : "Trade with verified businesses. Log in to buy or apply as a supplier."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {user ? (
            <>
              <Button
                render={
                  <Link
                    href={
                      profile?.user_type === "admin"
                        ? "/admin/dashboard"
                        : profile?.user_type === "supplier"
                          ? "/supplier/dashboard"
                          : "/supplier/onboarding"
                    }
                  />
                }
                nativeButton={false}
                className="w-full"
              >
                {profile?.user_type === "admin"
                  ? "Admin dashboard"
                  : profile?.user_type === "supplier"
                    ? "Supplier dashboard"
                    : "Become a supplier"}
              </Button>
              <form action={signOut}>
                <Button type="submit" variant="outline" className="w-full">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <Button
              render={<Link href="/auth/login" />}
              nativeButton={false}
              className="w-full"
            >
              Log in
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
