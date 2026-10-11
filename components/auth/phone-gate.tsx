"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import {
  getStoredUserPhone,
  setStoredUserPhone,
  USER_PHONE_STORAGE_KEY,
} from "@/lib/user-phone";

const INVALID_MESSAGE = "Enter a valid 10-digit mobile number.";

/**
 * Mandatory post-login phone gate (temporary, no verification yet).
 * Mounted globally; only renders for signed-in users missing a stored phone.
 */
export function PhoneGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [needsPhone, setNeedsPhone] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const recheck = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setNeedsPhone(Boolean(user) && getStoredUserPhone() === null);
    };

    void recheck();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setNeedsPhone(Boolean(session?.user) && getStoredUserPhone() === null);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === USER_PHONE_STORAGE_KEY) {
        void recheck();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = setStoredUserPhone(value);
    if (!saved) {
      setError(INVALID_MESSAGE);
      setSaving(false);
      return;
    }
    setError(null);
    setSaving(false);
    setNeedsPhone(false);
    router.refresh();
  };

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setNeedsPhone(false);
    setSigningOut(false);
    router.refresh();
  }, [router]);

  if (!needsPhone || pathname?.startsWith("/auth")) return null;

  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add your mobile number</DialogTitle>
          <DialogDescription>
            We need your mobile number to continue. Verification is coming
            soon — for now we just save it on this device.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="user-phone">Mobile number</FieldLabel>
              <Input
                id="user-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                maxLength={13}
                placeholder="98765 43210"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={error ? true : undefined}
              />
              <FieldDescription>
                10-digit Indian mobile number. Saved only in this browser for
                now.
              </FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>
            <Button type="submit" disabled={saving || value.trim().length === 0}>
              {saving ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Saving…
                </>
              ) : (
                "Save and continue"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={signingOut}
              onClick={handleSignOut}
            >
              {signingOut ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Signing out…
                </>
              ) : (
                "Sign out instead"
              )}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
