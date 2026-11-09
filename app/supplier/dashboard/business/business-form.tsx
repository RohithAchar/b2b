"use client";

import { useActionState, useState, useTransition, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import {
  updateBusinessProfile,
  deleteAccount,
  type KybActionState,
} from "@/lib/supplier/actions";

const initialState: KybActionState = { ok: false, message: "" };

export function BusinessProfileForm({
  businessName,
  contactPerson,
  logoPath,
}: {
  businessName: string;
  contactPerson: string;
  logoPath: string | null;
}) {
  const [state, action, pending] = useActionState(
    updateBusinessProfile,
    initialState,
  );
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setLogoPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
        objectUrlsRef.current = objectUrlsRef.current.filter(
          (u) => u !== prev,
        );
      }
      if (!file) {
        return null;
      }
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return url;
    });
  }

  const currentLogo =
    logoPreview ??
    (logoPath ? logoPublicUrl(logoPath) : null);

  return (
    <form action={action}>
      <FieldGroup>
        <Item variant="outline">
          <ItemMedia variant="image">
            {currentLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={currentLogo} alt="" />
            ) : null}
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{businessName}</ItemTitle>
            <ItemDescription>
              {currentLogo ? "Choose a file to replace the logo." : "No logo yet."}
            </ItemDescription>
          </ItemContent>
        </Item>
        <Field>
          <FieldLabel htmlFor="logo">Company logo</FieldLabel>
          <Input
            id="logo"
            name="logo"
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={onLogoChange}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="business_name">Company name</FieldLabel>
          <Input
            id="business_name"
            name="business_name"
            required
            minLength={2}
            defaultValue={businessName}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="contact_person">Contact name</FieldLabel>
          <Input
            id="contact_person"
            name="contact_person"
            required
            minLength={2}
            defaultValue={contactPerson}
          />
        </Field>
        {state.message ? (
          <Alert variant={state.ok ? "default" : "destructive"}>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </FieldGroup>
    </form>
  );
}

function logoPublicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${path}`;
}

/**
 * Delete account section shown under Settings on the supplier dashboard.
 * Only reachable by the company owner (the page itself is owner-gated).
 * Deleting the auth user cascades through the database (profile, company,
 * products/images/variants, memberships).
 */
export function DeleteAccountSection() {
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  const removeAccount = () =>
    start(async () => {
      const result = await deleteAccount();
      if (result.ok) {
        toast.add({
          type: "success",
          title: "Account deleted",
          description: result.message,
        });
        router.push("/auth/login");
      } else {
        toast.add({
          type: "error",
          title: "Could not delete account",
          description: result.message,
        });
      }
    });

  return (
    <section>
      <Card size="sm" className="!gap-0 !py-0">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your supplier account and all associated data.
            This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-5 flex flex-col gap-2">
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            className="w-full justify-start"
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="mr-2" />
            Delete my account
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </AlertDialogMedia>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your supplier account, business
                  profile, products, and all associated data. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={removeAccount} disabled={pending}>
                  Delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </section>
  );
}
