import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { EditCategoryForm } from "./edit-form";

type EditCategoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCategoryPage({
  params,
}: EditCategoryPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id, name, image_path")
    .eq("id", id)
    .maybeSingle();
  if (!category) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit category</CardTitle>
          <CardDescription>Rename the category or replace its image.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditCategoryForm
            id={category.id}
            name={category.name}
            imageKept={Boolean(category.image_path)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
