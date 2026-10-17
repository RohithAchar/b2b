import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuyerAddress } from "@/lib/orders/delivery";

type BuyerAddressRow = {
  id: string;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  instructions: string | null;
  is_default: boolean;
};

/** The signed-in buyer's saved addresses, default first. RLS scopes the read. */
export async function getBuyerAddresses(
  supabase: SupabaseClient,
  buyerId: string,
): Promise<BuyerAddress[]> {
  const { data } = await supabase
    .from("buyer_addresses")
    .select(
      "id, full_name, phone, line1, line2, city, state, pincode, instructions, is_default",
    )
    .eq("buyer_id", buyerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  return ((data ?? []) as BuyerAddressRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    instructions: row.instructions,
    isDefault: row.is_default,
  }));
}
