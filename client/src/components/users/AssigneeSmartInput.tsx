import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

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

  const enabled = open && query.trim().length >= 2;

  const fetchUsers = async () => {
    const q = query.trim();
    if (q.length < 2) return { items: [] };
    
    // Get JWT token from localStorage
    const token = localStorage.getItem("accessToken");
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`, {
      method: "GET",
      credentials: "include",
      headers,
    });
    if (!res.ok) return { items: [] };
    return res.json();
  };

  const { data, isFetching } = useQuery({
    queryKey: ["users-search", query], // stable key that changes only with query
    queryFn: fetchUsers,
    enabled,
    staleTime: 30_000,
  });

  const items: Array<{ id: string; email: string; name?: string; avatarUrl?: string | null }> =
    (data?.items ?? []).filter(Boolean);

  const canInvite = EMAIL_RE.test(query.trim()) && !items.some(u => u.email.toLowerCase() === query.trim().toLowerCase());

  async function invite(email: string) {
    // Get JWT token from localStorage
    const token = localStorage.getItem("accessToken");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch("/api/users/invite", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ email }),
    });
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