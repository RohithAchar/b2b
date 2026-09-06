import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  DeleteCategoryButton,
  ToggleVisibilityButton,
} from "./category-actions";

function imageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/category_images/${path}`;
}

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, image_path, is_active, sort_order")
    .order("sort_order")
    .order("name");

  const parents = (rows ?? []).filter((r) => !r.parent_id);
  const childrenOf = (parentId: string) =>
    (rows ?? []).filter((r) => r.parent_id === parentId);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium">Categories</h1>
          <p className="text-sm text-muted-foreground">
            What suppliers will browse. Hidden items stay invisible until you
            turn them on.
          </p>
        </div>
        <Button
          render={<Link href="/admin/dashboard/categories/new" />}
          nativeButton={false}
        >
          Add category
        </Button>
      </div>

      {parents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              No categories yet. Add the first one above.
            </p>
          </CardContent>
        </Card>
      ) : (
        parents.map((parent) => (
          <Card key={parent.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                {parent.image_path !== "pending" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(parent.image_path)}
                    alt=""
                    className="size-12 rounded-xl border border-border object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col">
                  <CardTitle>{parent.name}</CardTitle>
                  <CardDescription>
                    {parent.is_active ? "Visible" : "Hidden"}
                  </CardDescription>
                </div>
                <ToggleVisibilityButton
                  id={parent.id}
                  isActive={parent.is_active}
                />
                <Button
                  render={
                    <Link
                      href={`/admin/dashboard/categories/${parent.id}/edit`}
                    />
                  }
                  nativeButton={false}
                  variant="outline"
                >
                  Edit
                </Button>
                <DeleteCategoryButton id={parent.id} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {childrenOf(parent.id).map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-4 rounded-xl border border-border p-3"
                >
                  {child.image_path !== "pending" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(child.image_path)}
                      alt=""
                      className="size-10 rounded-xl border border-border object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {child.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {child.is_active ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <ToggleVisibilityButton
                    id={child.id}
                    isActive={child.is_active}
                  />
                  <Button
                    render={
                      <Link
                        href={`/admin/dashboard/categories/${child.id}/edit`}
                      />
                    }
                    nativeButton={false}
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <DeleteCategoryButton id={child.id} />
                </div>
              ))}
              <Button
                render={
                  <Link
                    href={`/admin/dashboard/categories/new?parent=${parent.id}`}
                  />
                }
                nativeButton={false}
                variant="outline"
                className="w-full"
              >
                Add subcategory
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
