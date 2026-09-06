import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signInWithGoogle } from "@/lib/auth/actions";
import { getSafeNextPath } from "@/lib/auth/paths";
import { AuthShell } from "../shell";
import { RequestOtpForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const safeNext = getSafeNextPath(next);

  return (
    <AuthShell
      heading="Log in to trade with verified businesses."
      steps={[
        "Enter your email — we send a 6-digit code, no password needed.",
        "Enter the code here, or continue with Google instead.",
        "Suppliers: apply once, then track verification from your dashboard.",
      ]}
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>
            Use your email or Google account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RequestOtpForm next={safeNext} />
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={safeNext} />
            <Button type="submit" variant="outline" className="w-full">
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
