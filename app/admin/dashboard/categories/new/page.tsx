import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { NewCategoryForm } from "./category-form";

type NewCategoryPageProps = {
  searchParams: Promise<{ parent?: string }>;
};

export default async function NewCategoryPage({
  searchParams,
}: NewCategoryPageProps) {
  const { parent } = await searchParams;
  const supabase = await createClient();
  const { data: parents } = await supabase
    .from("categories")
    .select("id, name")
    .is("parent_id", null)
    .order("name");

  const validPreselect =
    parent && (parents ?? []).some((p) => p.id === parent) ? parent : "";

  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
          <CardDescription>
            {validPreselect
              ? "New subcategory. It appears under its parent."
              : "New top-level category, or pick a parent to make a subcategory."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewCategoryForm
            parents={parents ?? []}
            preselectedParent={validPreselect}
          />
        </CardContent>
      </Card>
    </div>
  );
}
