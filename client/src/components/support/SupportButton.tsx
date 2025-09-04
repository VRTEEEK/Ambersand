import { useState } from "react";
import { SupportModal } from "./SupportModal";

export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open technical support"
        className="fixed left-4 bottom-4 z-50 rounded-full px-4 py-2 shadow bg-black/80 text-white hover:bg-black"
      >
        Support
      </button>
      <SupportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}