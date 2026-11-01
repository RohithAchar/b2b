import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/dashboard/status-badge";
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
    .select("id, name, slug, image_path, is_active, sort_order")
    .order("sort_order")
    .order("name");

  const categories = rows ?? [];

  return (
    <div className="mx-auto flex w-full flex-col gap-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-xl font-bold tracking-tight">Categories</h1>
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

      {categories.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyTitle>No categories yet</EmptyTitle>
              <EmptyDescription>
                Add the first one to get started.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <ItemGroup>
              {categories.map((category) => (
                <Item key={category.id} variant="outline" size="sm">
                  {category.image_path && category.image_path !== "pending" ? (
                    <ItemMedia variant="image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(category.image_path)} alt="" loading="lazy" decoding="async" />
                    </ItemMedia>
                  ) : null}
                  <ItemContent>
                    <ItemTitle>{category.name}</ItemTitle>
                    <ItemDescription>
                      {category.is_active ? "Visible" : "Hidden"}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusBadge
                      status="visibility"
                      value={category.is_active ? "active" : "inactive"}
                    />
                    <ToggleVisibilityButton
                      id={category.id}
                      isActive={category.is_active}
                    />
                    <Button
                      render={
                        <Link
                          href={`/admin/dashboard/categories/${category.id}/edit`}
                        />
                      }
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <DeleteCategoryButton id={category.id} />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
