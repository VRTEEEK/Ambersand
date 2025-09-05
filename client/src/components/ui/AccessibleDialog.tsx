import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Visible title for screen readers and a11y; will render visually unless hidden */
  title: string;
  /** Optional description; if omitted, we unset aria-describedby to silence warnings */
  description?: string;
  /** Hide visible title but keep it for screen readers */
  hideTitleVisually?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function AccessibleDialog({
  open,
  onOpenChange,
  title,
  description,
  hideTitleVisually = false,
  children,
  footer,
  className,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={className}
        {...(!description ? { "aria-describedby": undefined } : {})}
      >
        <DialogHeader>
          {hideTitleVisually ? (
            <VisuallyHidden>
              <DialogTitle>{title}</DialogTitle>
            </VisuallyHidden>
          ) : (
            <DialogTitle>{title}</DialogTitle>
          )}
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="mt-2">{children}</div>

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

export default AccessibleDialog;