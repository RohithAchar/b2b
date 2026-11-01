import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"

/**
 * Tabbed product content. Only the tab switcher is interactive; the
 * (potentially large) description/highlights/return panels are server-rendered
 * and passed in as ReactNode props so they never execute on the client.
 */
export function ProductDetailTabs({
  description,
  highlights,
  returnPolicy,
}: {
  description: React.ReactNode
  highlights: React.ReactNode
  returnPolicy: React.ReactNode
}) {
  return (
    <Tabs defaultValue="description">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="description">Description</TabsTrigger>
        <TabsTrigger value="highlights">Highlights</TabsTrigger>
        <TabsTrigger value="return-policy">Return Policy</TabsTrigger>
      </TabsList>

      <TabsContent value="description" className="mt-4">
        {description}
      </TabsContent>
      <TabsContent value="highlights" className="mt-4">
        {highlights}
      </TabsContent>
      <TabsContent value="return-policy" className="mt-4">
        {returnPolicy}
      </TabsContent>
    </Tabs>
  )
}
