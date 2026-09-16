import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/layout/page-header";
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader
        title="Categories"
        description="What suppliers will browse. Hidden items stay invisible until you turn them on."
        actions={
          <Button
            render={<Link href="/admin/dashboard/categories/new" />}
            nativeButton={false}
          >
            Add category
          </Button>
        }
      />

      {parents.length === 0 ? (
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
        parents.map((parent) => (
          <Card key={parent.id}>
            <CardHeader>
              <CardTitle>{parent.name}</CardTitle>
              <CardDescription>
                {parent.is_active ? "Visible" : "Hidden"}
              </CardDescription>
              <CardAction>
                <Badge variant={parent.is_active ? "default" : "outline"}>
                  {parent.is_active ? "Visible" : "Hidden"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ItemGroup>
                <Item variant="outline" size="sm">
                  {parent.image_path && parent.image_path !== "pending" ? (
                    <ItemMedia variant="image">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(parent.image_path)} alt="" />
                    </ItemMedia>
                  ) : null}
                  <ItemContent>
                    <ItemTitle>{parent.name}</ItemTitle>
                    <ItemDescription>
                      Top-level category
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
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
                      size="sm"
                    >
                      Edit
                    </Button>
                    <DeleteCategoryButton id={parent.id} />
                  </ItemActions>
                </Item>
                {childrenOf(parent.id).map((child) => (
                  <Item key={child.id} variant="outline" size="sm">
                    {child.image_path && child.image_path !== "pending" ? (
                      <ItemMedia variant="image">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl(child.image_path)} alt="" />
                      </ItemMedia>
                    ) : null}
                    <ItemContent>
                      <ItemTitle>{child.name}</ItemTitle>
                      <ItemDescription>
                        {child.is_active ? "Visible" : "Hidden"}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
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
                        size="sm"
                      >
                        Edit
                      </Button>
                      <DeleteCategoryButton id={child.id} />
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
              <Button
                render={
                  <Link
                    href={`/admin/dashboard/categories/new?parent=${parent.id}`}
                  />
                }
                nativeButton={false}
                variant="outline"
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
