import { redirect } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/session";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { requireOwnerCompany } from "@/lib/auth/guard";
import { TeamAddForm } from "./team-add-form";
import { TeamRemoveButton } from "./team-remove-button";

type MemberRow = {
  id: string;
  email: string;
  created_at: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SupplierTeamPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect(LOGIN_PATH);
  }

  const companyId = await requireOwnerCompany(supabase, user.id);

  const { data: members } = await supabase
    .from("company_members")
    .select("id, email, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  const rows = ((members ?? []) as MemberRow[]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Team</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Staff see your catalogue, orders and customers — never business profile, verification, margin or this page.
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {rows.length} {rows.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>Add a team member</CardTitle>
          <CardDescription>
            Enter their account email. They need an existing account — buyers are upgraded automatically on first visit.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-5">
          <TeamAddForm />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Removing someone ends their access immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="!px-0">
          {rows.length === 0 ? (
            <Empty className="!border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={UserGroup02Icon} strokeWidth={2} />
                </EmptyMedia>
                <EmptyTitle>No team members yet</EmptyTitle>
                <EmptyDescription>
                  Add someone above to let them help run your business.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="max-w-48 truncate font-medium">
                        {m.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">staff</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(m.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <TeamRemoveButton memberId={m.id} email={m.email} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
