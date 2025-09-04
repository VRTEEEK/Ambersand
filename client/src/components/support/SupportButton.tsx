import { useState } from "react";
import { createPortal } from "react-dom";
import { SupportModal } from "./SupportModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {createPortal(
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open technical support"
              className="fixed left-6 bottom-6 z-[9999] rounded-full px-4 py-2 shadow bg-neutral-800 text-white hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 lg:left-72"
            >
              Support
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contact Technical Support</p>
          </TooltipContent>
        </Tooltip>,
        document.body
      )}
      <SupportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}