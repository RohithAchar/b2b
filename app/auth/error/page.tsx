import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "../shell";

const REASONS: Record<string, string> = {
  "google-not-configured":
    "Google login is not connected yet. Use an email code instead.",
  "missing-code": "That login link was incomplete. Start again from login.",
  "exchange-failed":
    "That login link expired or was already used. Request a fresh code.",
  "redirect-unresolved":
    "Could not determine this session's address. Start again from login.",
};

type ErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const { reason } = await searchParams;
  const message =
    (reason && REASONS[reason]) ??
    "Something went wrong signing you in. Start again from login.";

  return (
    <AuthShell
      heading="That login attempt didn't work. Here's the fix."
      steps={[
        "Expired or twice-used links fail — this is the most common cause.",
        "Go back, request a fresh code, and use the latest email.",
        "If it keeps failing, try the Google option instead.",
      ]}
    >
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Login didn&apos;t work</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            render={<Link href="/auth/login" />}
            nativeButton={false}
            className="w-full"
          >
            Back to login
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
