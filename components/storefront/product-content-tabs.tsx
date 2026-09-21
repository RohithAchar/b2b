"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

/**
 * Tabbed product content. Only the tab switcher itself is interactive; the
 * (potentially large) description/spec/variant panels are server-rendered and
 * passed in as ReactNode props so they never execute on the client.
 */
export function ProductDetailTabs({
  description,
  specifications,
  variants,
}: {
  description: React.ReactNode;
  specifications: React.ReactNode | null;
  variants: React.ReactNode | null;
}) {
  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Description</TabsTrigger>
        {specifications ? (
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
        ) : null}
        {variants ? <TabsTrigger value="variants">Variants</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="description" className="mt-4">
        {description}
      </TabsContent>
      {specifications ? (
        <TabsContent value="specifications" className="mt-4">
          {specifications}
        </TabsContent>
      ) : null}
      {variants ? (
        <TabsContent value="variants" className="mt-4">
          {variants}
        </TabsContent>
      ) : null}
    </Tabs>
  );
}