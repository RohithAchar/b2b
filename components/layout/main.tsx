import type { HTMLAttributes } from "react";
import { cn } from "cn";

type MainProps = HTMLAttributes<HTMLElement> & {
  fluid?: boolean;
};

export function Main({ fluid, className, children, ...props }: MainProps) {
  return (
    <main
      className={cn(
        "px-4 py-6",
        !fluid && "@xl/content:mx-auto @xl/content:w-full @xl/content:max-w-7xl",
        className,
      )}
      {...props}
    >
      {children}
    </main>
  );
}
