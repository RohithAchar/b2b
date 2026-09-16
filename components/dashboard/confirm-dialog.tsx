"use client";

import { cloneElement, isValidElement, useState, type ReactElement } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type TriggerProps = {
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  variant = "destructive",
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  const openTrigger =
    isValidElement(trigger) && typeof trigger.type !== "string"
      ? cloneElement(trigger as ReactElement<TriggerProps>, {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            (trigger.props as TriggerProps).onClick?.(event);
            setOpen(true);
          },
        })
      : trigger;

  return (
    <>
      {openTrigger}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOpen(false)}>
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={variant}
              onClick={() => {
                setOpen(false);
                void onConfirm();
              }}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}