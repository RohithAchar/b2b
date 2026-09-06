import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const REASONS: Record<string, string> = {
  "google-not-configured":
    "Google login is not connected yet. Use an email code instead.",
  "missing-code": "That login link was incomplete. Try again.",
  "exchange-failed": "That login link expired or was already used. Try again.",
};

type ErrorPageProps = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const { reason } = await searchParams;
  const message =
    (reason && REASONS[reason]) ??
    "Something went wrong signing you in. Try again.";

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Login failed</CardTitle>
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
    </div>
  );
}
