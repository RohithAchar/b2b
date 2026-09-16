import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";

export function SearchInput({
  placeholder = "Search…",
  name = "q",
  defaultValue,
  className,
  ...props
}: React.ComponentProps<typeof InputGroupInput> & {
  placeholder?: string;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <InputGroup className={cn("w-full sm:w-64", className)}>
      <InputGroupAddon align="inline-start">
        <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        {...props}
      />
    </InputGroup>
  );
}