"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { parseDeliverySnapshot } from "@/lib/orders/delivery";

// Buyer delivery-address management. Ownership is enforced two ways: the
// buyer_id column is always set from the authenticated session (never from
// the form), and every write is additionally scoped by buyer_id so a forged
// address id can never touch another buyer's row (RLS is the third layer).

export type AddressActionState = {
  ok: boolean;
  message: string;
  addressId?: string;
};

const okState = (message: string, addressId?: string): AddressActionState => ({
  ok: true,
  message,
  addressId,
});
const errState = (message: string): AddressActionState => ({ ok: false, message });

const addressIdSchema = z.string().uuid("Invalid address.");

function rawAddressFromForm(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    line1: formData.get("line1"),
    line2: formData.get("line2") || null,
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    instructions: formData.get("instructions") || null,
  };
}

/**
 * Create or update a delivery address for the signed-in buyer.
 * Pass `addressId` in the form to edit an existing row.
 */
export async function saveAddress(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const parsed = parseDeliverySnapshot(rawAddressFromForm(formData));
  if (!parsed.ok) {
    return errState(parsed.error);
  }
  // Checkboxes submit "on" when checked and nothing when unchecked.
  const isDefault = formData.get("isDefault") === "on";

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in to save an address.");
  }

  const addressIdRaw = formData.get("addressId");
  let addressId: string | null = null;
  if (addressIdRaw) {
    const parsedId = addressIdSchema.safeParse(addressIdRaw);
    if (!parsedId.success) {
      return errState("Invalid address.");
    }
    addressId = parsedId.data;
  }

  // The first address a buyer saves becomes the default automatically.
  const { count } = await supabase
    .from("buyer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id);
  const makeDefault = isDefault || (count ?? 0) === 0;

  // Single-default invariant: clear the flag elsewhere before setting it here
  // (a partial unique index rejects two defaults in the same statement).
  if (makeDefault) {
    let unset = supabase
      .from("buyer_addresses")
      .update({ is_default: false })
      .eq("buyer_id", user.id);
    if (addressId) unset = unset.neq("id", addressId);
    const { error: unsetError } = await unset;
    if (unsetError) {
      console.error("saveAddress unset-default failed:", unsetError.code, unsetError.message);
      return errState("Could not update your default address. Try again.");
    }
  }

  const payload = {
    ...parsed.value,
    is_default: makeDefault,
  };

  if (addressId) {
    const { data, error } = await supabase
      .from("buyer_addresses")
      .update(payload)
      .eq("id", addressId)
      .eq("buyer_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("saveAddress update failed:", error.code, error.message);
      return errState("Could not save your address. Try again.");
    }
    if (!data) {
      return errState("That address no longer exists.");
    }
    revalidatePath("/account");
    return okState("Address updated.", data.id as string);
  }

  const { data, error } = await supabase
    .from("buyer_addresses")
    .insert({ ...payload, buyer_id: user.id })
    .select("id")
    .single();
  if (error) {
    console.error("saveAddress insert failed:", error.code, error.message);
    return errState("Could not save your address. Try again.");
  }
  revalidatePath("/account");
  return okState("Address saved.", data.id as string);
}

/** Remove one of the buyer's own addresses. */
export async function deleteAddress(addressId: string): Promise<AddressActionState> {
  const parsedId = addressIdSchema.safeParse(addressId);
  if (!parsedId.success) {
    return errState("Invalid address.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in.");
  }

  const { data: deleted } = await supabase
    .from("buyer_addresses")
    .delete()
    .eq("id", parsedId.data)
    .eq("buyer_id", user.id)
    .select("id, is_default")
    .maybeSingle();
  if (!deleted) {
    return errState("That address no longer exists.");
  }

  // Keep a default whenever any address remains: promote the oldest one.
  if (deleted.is_default) {
    const { data: next } = await supabase
      .from("buyer_addresses")
      .select("id")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("buyer_addresses")
        .update({ is_default: true })
        .eq("id", next.id as string)
        .eq("buyer_id", user.id);
    }
  }

  revalidatePath("/account");
  return okState("Address removed.");
}

/** Mark one of the buyer's own addresses as the default. */
export async function setDefaultAddress(addressId: string): Promise<AddressActionState> {
  const parsedId = addressIdSchema.safeParse(addressId);
  if (!parsedId.success) {
    return errState("Invalid address.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in.");
  }

  const { error: unsetError } = await supabase
    .from("buyer_addresses")
    .update({ is_default: false })
    .eq("buyer_id", user.id)
    .neq("id", parsedId.data);
  if (unsetError) {
    console.error("setDefaultAddress unset failed:", unsetError.code, unsetError.message);
    return errState("Could not update your default address. Try again.");
  }

  const { data, error } = await supabase
    .from("buyer_addresses")
    .update({ is_default: true })
    .eq("id", parsedId.data)
    .eq("buyer_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("setDefaultAddress failed:", error.code, error.message);
    return errState("Could not update your default address. Try again.");
  }
  if (!data) {
    return errState("That address no longer exists.");
  }

  revalidatePath("/account");
  return okState("Default address updated.");
}
