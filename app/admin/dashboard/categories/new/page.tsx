import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewCategoryForm } from "./category-form";

export default function NewCategoryPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
          <CardDescription>
            New category for suppliers to list products under.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewCategoryForm />
        </CardContent>
      </Card>
    </div>
  );
}
