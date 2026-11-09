"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { saveProductAdditionalInfo } from "@/lib/supplier/product-actions";
import type { ProductActionState } from "@/lib/supplier/product-actions";

const initialState: ProductActionState = { ok: false, message: "" };

export function AdditionalInfoForm({
  productId,
  product,
}: {
  productId: string;
  product: {
    negotiable: boolean;
    is_winning: boolean;
    is_hot_selling: boolean;
    packaging_details: string | null;
    warranty_return: string | null;
    carton_units: number | null;
    carton_dimensions: string | null;
    carton_weight_kg: number | null;
    youtube_url: string | null;
    seo_title: string | null;
    seo_description: string | null;
  };
  variants: { id: string; label: string; seller_sku: string; price: number; moq: number | null; stock_qty: number; sort: number }[];
}) {
  const [state, action, pending] = useActionState(
    (prev: ProductActionState, formData: FormData) =>
      saveProductAdditionalInfo(productId, prev, formData),
    initialState,
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Switch name="negotiable" defaultChecked={product.negotiable} />
          <Label>Negotiable price</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch name="is_winning" defaultChecked={product.is_winning} />
          <Label>Winning product</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch name="is_hot_selling" defaultChecked={product.is_hot_selling} />
          <Label>Hot selling</Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="carton_units">Units per carton</Label>
          <Input
            id="carton_units"
            name="carton_units"
            type="number"
            min={1}
            defaultValue={product.carton_units ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="carton_dimensions">Carton dimensions</Label>
          <Input
            id="carton_dimensions"
            name="carton_dimensions"
            defaultValue={product.carton_dimensions ?? ""}
            placeholder="40 × 30 × 25 cm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="carton_weight_kg">Carton weight (kg)</Label>
          <Input
            id="carton_weight_kg"
            name="carton_weight_kg"
            type="number"
            min={0.001}
            step="0.001"
            defaultValue={product.carton_weight_kg ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="packaging_details">Packaging details</Label>
        <Textarea
          id="packaging_details"
          name="packaging_details"
          defaultValue={product.packaging_details ?? ""}
          maxLength={1000}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="warranty_return">Warranty / return policy</Label>
        <Textarea
          id="warranty_return"
          name="warranty_return"
          defaultValue={product.warranty_return ?? ""}
          maxLength={1000}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="youtube_url">YouTube URL</Label>
        <Input
          id="youtube_url"
          name="youtube_url"
          defaultValue={product.youtube_url ?? ""}
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="seo_title">SEO title</Label>
        <Input
          id="seo_title"
          name="seo_title"
          defaultValue={product.seo_title ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="seo_description">SEO description</Label>
        <Textarea
          id="seo_description"
          name="seo_description"
          defaultValue={product.seo_description ?? ""}
        />
      </div>

      {state.message ? (
        <Alert variant={state.ok ? "default" : "destructive"}>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save additional info"}
        </Button>
      </div>
    </form>
  );
}
