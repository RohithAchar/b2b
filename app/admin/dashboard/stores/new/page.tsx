import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewStoreForm } from "./store-form";

export default function NewStorePage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Add store</CardTitle>
          <CardDescription>
            Create a new storefront. Store names and slugs must be unique.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewStoreForm />
        </CardContent>
      </Card>
    </div>
  );
}
