import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { EditStoreForm } from "./edit-form";

type EditStorePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditStorePage({
  params,
}: EditStorePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, description, status")
    .eq("id", id)
    .maybeSingle();
  if (!store) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit store</CardTitle>
          <CardDescription>
            Update the store name, description, or status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditStoreForm
            id={store.id}
            name={store.name}
            description={store.description ?? ""}
            status={store.status}
          />
        </CardContent>
      </Card>
    </div>
  );
}
