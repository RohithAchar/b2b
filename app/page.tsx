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

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>B2B Marketplace</CardTitle>
          <CardDescription>
            {user ? `Signed in as ${user.email}.` : "You are browsing as a guest."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {user ? (
            <>
              <Button
                render={<Link href="/dashboard" />}
                nativeButton={false}
                className="w-full"
              >
                Go to dashboard
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
