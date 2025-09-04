import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as Tooltip from "@radix-ui/react-tooltip";
import { SupportModal } from "./SupportModal";

export function SupportButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRef.current = document.body; // always portal to body
    setMounted(true);
  }, []);

  const btn = (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open technical support"
            className="fixed left-4 bottom-4 z-[1000] rounded-full px-3 py-1.5 shadow
                       bg-neutral-800 text-white hover:bg-neutral-700
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-400"
          >
            Support
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="start"
            className="select-none rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow"
          >
            Contact Technical Support
            <Tooltip.Arrow className="fill-neutral-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );

  return (
    <>
      {mounted && portalRef.current ? createPortal(btn, portalRef.current) : null}
      {/* Modal also portals to body (see step 3) */}
      <SupportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}