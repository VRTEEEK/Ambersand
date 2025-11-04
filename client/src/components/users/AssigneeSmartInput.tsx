import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AssigneeSmartInput({ onResolve, disabled }: {
  onResolve: (r:
    | { type: "existing"; userId: string; email: string; name?: string }
    | { type: "invite"; inviteId: number; email: string }
  ) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const enabled = open && query.trim().length >= 1;

  const { data, isFetching } = useQuery({
    queryKey: ["/api/users/search", query],
    queryFn: async () => {
      const q = query.trim();
      if (q.length < 1) return { items: [] };
      
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });

  const items: Array<{ id: string; email: string; name?: string; avatarUrl?: string | null }> =
    (data?.items ?? []).filter(Boolean);

  const canInvite = EMAIL_RE.test(query.trim()) && !items.some(u => u.email.toLowerCase() === query.trim().toLowerCase());

  async function invite(email: string) {
    try {
      const res = await apiRequest("/api/users/invite", "POST", { email });
      
      if (res.status === 409) {
        const { userId } = await res.json();
        onResolve({ type: "existing", userId, email });
        setOpen(false);
        setQuery(email);
        return;
      }
      
      if (!res.ok) {
        const err = await res.text();
        alert(`Failed to send invite: ${err || res.status}`);
        return;
      }
      
      const { inviteId } = await res.json();
      onResolve({ type: "invite", inviteId, email });
      setOpen(false);
      setQuery(`Invited: ${email}`);
    } catch (error: any) {
      alert(`Failed to send invite: ${error.message || 'Unknown error'}`);
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded border p-2"
          placeholder="Type a name or email…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 300)}
          disabled={disabled}
          aria-autocomplete="list"
          aria-expanded={open}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-white shadow">
          {isFetching && <div className="p-2 text-sm text-neutral-500">Searching…</div>}

          {!isFetching && items.length > 0 && (
            <ul className="max-h-64 overflow-auto py-1">
              {items.map(u => (
                <li
                  key={u.id}
                  className="cursor-pointer px-3 py-2 hover:bg-neutral-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onResolve({ type: "existing", userId: u.id, email: u.email, name: u.name });
                    setOpen(false);
                    setQuery(u.name || u.email || "Selected User");
                  }}
                >
                  <div className="text-sm font-medium">{u.name || u.email}</div>
                  <div className="text-xs text-neutral-500">{u.email}</div>
                </li>
              ))}
            </ul>
          )}

          {!isFetching && items.length === 0 && !canInvite && (
            <div className="p-2 text-sm text-neutral-500">No users found. Keep typing…</div>
          )}

          {!isFetching && canInvite && (
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-neutral-50"
              onMouseDown={(e) => {
                e.preventDefault();
                invite(query.trim());
              }}
            >
              <span className="text-sm">
                Invite <span className="font-semibold">{query.trim()}</span>
              </span>
              <span className="text-xs text-neutral-500">Send email invite</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}