import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSafeNextPath } from "@/lib/auth/paths";
import { VerifyOtpForm } from "./verify-form";

type VerifyPageProps = {
  searchParams: Promise<{ email?: string; next?: string }>;
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { email, next } = await searchParams;

  if (!email) {
    redirect("/auth/login");
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <VerifyOtpForm email={email} next={getSafeNextPath(next)} />
          <p className="text-xs text-muted-foreground">
            The email also contains a login link — either works. Each new code
            expires the previous ones, so use the latest email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
