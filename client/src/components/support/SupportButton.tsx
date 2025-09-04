import { useState } from "react";
import { createPortal } from "react-dom";
import { SupportModal } from "./SupportModal";

export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {createPortal(
        <button
          onClick={() => setOpen(true)}
          aria-label="Open technical support"
          className="fixed left-4 bottom-4 z-[9999] rounded-full px-4 py-2 shadow bg-black/80 text-white hover:bg-black"
        >
          Support
        </button>,
        document.body
      )}
      <SupportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}