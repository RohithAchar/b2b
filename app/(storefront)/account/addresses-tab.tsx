"use client";

import { useEffect, useRef, useState, useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  Edit02Icon,
  MapPinIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  deleteAddress,
  saveAddress,
  setDefaultAddress,
  type AddressActionState,
} from "@/lib/buyer/address-actions";
import { getStoredUserPhone } from "@/lib/user-phone";
import {
  detectAddressFromDevice,
  locationFailureMessage,
} from "@/lib/buyer/geolocation";
import { formatDeliveryLine, type BuyerAddress } from "@/lib/orders/delivery";

const initialState: AddressActionState = { ok: false, message: "" };

export function AddressesTab({
  addresses,
}: {
  addresses: BuyerAddress[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BuyerAddress | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();

  function openForm(address: BuyerAddress | null) {
    setEditing(address);
    setFormKey((key) => key + 1); // reset the form fields on every open
    setFormOpen(true);
  }

  function runListAction(action: () => Promise<AddressActionState>) {
    setListError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setListError(result.message);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Delivery addresses are used at checkout and can&apos;t be changed on an
          order after it is placed.
        </p>
        <Button onClick={() => openForm(null)}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} data-icon="inline-start" />
          Add address
        </Button>
      </div>

      {listError ? (
        <Alert variant="destructive">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      ) : null}

      {addresses.length === 0 ? (
        <div className="py-10">
          <Empty>
            <EmptyTitle>No saved addresses</EmptyTitle>
            <EmptyDescription>
              Add a delivery address so checkout takes seconds, not minutes.
            </EmptyDescription>
          </Empty>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{address.fullName}</span>
                  <span className="text-sm text-muted-foreground">{address.phone}</span>
                  {address.isDefault ? <Badge>Default</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDeliveryLine(address)}
                </p>
                {address.instructions ? (
                  <p className="text-xs text-muted-foreground">
                    Note: {address.instructions}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingAction}
                  onClick={() => openForm(address)}
                >
                  <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} data-icon="inline-start" />
                  Edit
                </Button>
                {!address.isDefault ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingAction}
                    onClick={() => runListAction(() => setDefaultAddress(address.id))}
                  >
                    Set default
                  </Button>
                ) : null}
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" disabled={pendingAction}>
                      <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
                      Delete
                    </Button>
                  }
                  title="Delete this address?"
                  description={`"${formatDeliveryLine(address)}" will be removed. Orders already placed keep their saved copy.`}
                  confirmLabel="Delete address"
                  onConfirm={() => runListAction(() => deleteAddress(address.id))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Phone numbers are for delivery coordination. They are stored with your
        address and shared only with the supplier of an order you place.
      </p>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit address" : "Add address"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this address. Existing orders keep the address they were placed with."
                : "Where should suppliers deliver your orders?"}
            </DialogDescription>
          </DialogHeader>
          <AddressForm
            key={formKey}
            initial={editing}
            hasAddresses={addresses.length > 0}
            onDone={() => {
              setFormOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressForm({
  initial,
  hasAddresses,
  onDone,
}: {
  initial: BuyerAddress | null;
  hasAddresses: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveAddress, initialState);
  const phoneRef = useRef<HTMLInputElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);
  const pincodeRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  async function fillFromLocation() {
    setLocating(true);
    setLocateError(null);
    const result = await detectAddressFromDevice();
    setLocating(false);
    if (!result.ok) {
      setLocateError(locationFailureMessage(result.reason));
      return;
    }
    const detected = result.address;
    // Best-effort convenience prefill only, mirroring the phone prefill above:
    // the values are validated and saved server-side like any other input.
    if (detected.line1 && line1Ref.current) line1Ref.current.value = detected.line1;
    if (detected.city && cityRef.current) cityRef.current.value = detected.city;
    if (detected.state && stateRef.current) stateRef.current.value = detected.state;
    if (detected.pincode && pincodeRef.current) pincodeRef.current.value = detected.pincode;
  }

  useEffect(() => {
    // Best-effort convenience prefill only; the value is validated and saved
    // server-side like any other input. localStorage is never authoritative.
    if (!initial && !phoneRef.current?.value) {
      const stored = getStoredUserPhone();
      if (stored && phoneRef.current) phoneRef.current.value = stored;
    }
  }, [initial]);

  useEffect(() => {
    if (state.ok && state.message) {
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="flex min-h-0 flex-col gap-6">
      <FieldGroup className="no-scrollbar -mx-6 min-h-0 w-auto flex-1 overflow-y-auto overscroll-contain px-6">
        {!state.ok && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {initial ? <input type="hidden" name="addressId" value={initial.id} /> : null}

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="outline"
            disabled={locating || pending}
            onClick={() => void fillFromLocation()}
          >
            {locating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <HugeiconsIcon icon={MapPinIcon} strokeWidth={2} data-icon="inline-start" />
            )}
            {locating ? "Finding your location…" : "Fill from my location"}
          </Button>
          {locateError ? (
            <p className="text-xs text-muted-foreground">{locateError}</p>
          ) : null}
        </div>

        <Field>
          <FieldLabel htmlFor="fullName">Full name</FieldLabel>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            defaultValue={initial?.fullName ?? ""}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone number</FieldLabel>
          <Input
            id="phone"
            name="phone"
            ref={phoneRef}
            inputMode="numeric"
            autoComplete="tel"
            defaultValue={initial?.phone ?? ""}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="line1">Address line 1</FieldLabel>
          <Input
            id="line1"
            name="line1"
            ref={line1Ref}
            autoComplete="address-line1"
            defaultValue={initial?.line1 ?? ""}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="line2">Address line 2 (optional)</FieldLabel>
          <Input
            id="line2"
            name="line2"
            autoComplete="address-line2"
            defaultValue={initial?.line2 ?? ""}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <Input
              id="city"
              name="city"
              ref={cityRef}
              autoComplete="address-level2"
              defaultValue={initial?.city ?? ""}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="state">State</FieldLabel>
            <Input
              id="state"
              name="state"
              ref={stateRef}
              autoComplete="address-level1"
              defaultValue={initial?.state ?? ""}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="pincode">PIN code</FieldLabel>
            <Input
              id="pincode"
              name="pincode"
              ref={pincodeRef}
              inputMode="numeric"
              autoComplete="postal-code"
              defaultValue={initial?.pincode ?? ""}
              required
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="instructions">
            Delivery instructions (optional)
          </FieldLabel>
          <Textarea
            id="instructions"
            name="instructions"
            rows={2}
            defaultValue={initial?.instructions ?? ""}
          />
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id="isDefault"
            name="isDefault"
            value="on"
            defaultChecked={initial ? initial.isDefault : !hasAddresses}
          />
          <FieldLabel htmlFor="isDefault">Use as my default delivery address</FieldLabel>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? "Saving…" : initial ? "Save changes" : "Save address"}
        </Button>
      </DialogFooter>
    </form>
  );
}
