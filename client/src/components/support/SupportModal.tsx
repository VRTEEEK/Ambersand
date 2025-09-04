import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface SupportModalProps {
  open: boolean;
  onClose: () => void;
}

export function SupportModal({ open, onClose }: SupportModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const t = title.trim();
    const d = description.trim();
    
    if (t.length < 3 || t.length > 120) {
      toast({
        title: "Invalid Title",
        description: "Title must be between 3-120 characters.",
        variant: "destructive",
      });
      return;
    }
    
    if (d.length < 10 || d.length > 4000) {
      toast({
        title: "Invalid Description",
        description: "Description must be between 10-4000 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: t, 
          description: d, 
          path: window.location.pathname 
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Support Request Sent",
        description: "Your technical support request has been submitted successfully.",
      });

      onClose();
      setTitle("");
      setDescription("");
    } catch (error) {
      toast({
        title: "Failed to Send",
        description: "Could not send your support request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content 
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-gray-800 p-6 shadow-lg border"
          onKeyDown={handleKeyDown}
        >
          <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Contact Technical Support
          </Dialog.Title>
          <Dialog.Description className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Describe your technical issue and we'll help you resolve it quickly.
          </Dialog.Description>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="support-title" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Title
              </label>
              <input
                id="support-title"
                type="text"
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Short summary (e.g., Cannot upload evidence)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                maxLength={120}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {title.length}/120 characters
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="support-description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="support-description"
                className="w-full min-h-[140px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                placeholder="Describe the issue, steps to reproduce, error messages, IDs, etc."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
              />
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {description.length}/4000 characters
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <button 
              className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50" 
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" 
              onClick={handleSubmit} 
              disabled={loading || !title.trim() || !description.trim()}
            >
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}