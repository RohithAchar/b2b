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
    .select("id, name, parent_id, image_path")
    .eq("id", id)
    .maybeSingle();
  if (!category) {
    notFound();
  }

  const { data: parents } = await supabase
    .from("categories")
    .select("id, name")
    .is("parent_id", null)
    .order("name");

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit category</CardTitle>
          <CardDescription>
            Rename, move under a parent, or replace the image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditCategoryForm
            id={category.id}
            name={category.name}
            parentId={category.parent_id}
            imageKept={Boolean(category.image_path)}
            parents={parents ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
