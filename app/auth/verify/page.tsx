import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSafeNextPath } from "@/lib/auth/paths";
import { AuthShell } from "../shell";
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
    <AuthShell
      heading="One code stands between you and the marketplace."
      steps={[
        "Open the latest email we sent — earlier codes no longer work.",
        "Enter the 6 digits here, or click the login link in the email.",
        "Codes expire quickly. Request a fresh one if this one fails.",
      ]}
    >
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
            Use the latest email — each new code expires the previous ones.
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
