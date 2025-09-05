export async function getWorkflow(taskId: number) {
  const r = await fetch(`/api/workflows/${taskId}`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function setRoute(taskId: number, steps: { userId: string; role: string }[]) {
  const r = await fetch(`/api/workflows/${taskId}/route`, {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function submitStep(taskId: number) {
  const r = await fetch(`/api/workflows/${taskId}/submit`, { 
    method: "POST", 
    credentials: "include" 
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function returnTo(taskId: number, toUserId: string, comment: string) {
  const r = await fetch(`/api/workflows/${taskId}/return`, {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId, comment }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function approve(taskId: number) {
  const r = await fetch(`/api/workflows/${taskId}/approve`, { 
    method: "POST", 
    credentials: "include" 
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function reject(taskId: number, toUserId: string, comment: string) {
  const r = await fetch(`/api/workflows/${taskId}/reject`, {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId, comment }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}