export type WorkflowSnapshot = {
  workflow?: {
    state: "draft"|"collecting"|"in_peer_review"|"returned"|"escalated"|"compliance_review"|"approved"|"rejected";
    currentStepIndex: number;
    currentAssigneeId?: string|null;
  } | null;
  route: Array<{ id:number; stepIndex:number; userId:string; role:string }>;
  history: Array<{ id:number; action:string; actorId:string; toUserId?:string|null; comment?:string|null; createdAt:string; fromStepIndex?:number|null; toStepIndex?:number|null }>;
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function getWorkflow(taskId: number): Promise<WorkflowSnapshot> {
  const r = await fetch(`/api/workflows/${taskId}`, { 
    credentials: "include",
    headers: getAuthHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function setRoute(taskId: number, steps: { userId: string; role: string }[]) {
  const r = await fetch(`/api/workflows/${taskId}/route`, {
    method: "POST", 
    credentials: "include",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ steps }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function submitStep(taskId: number) {
  const r = await fetch(`/api/workflows/${taskId}/submit`, { 
    method: "POST", 
    credentials: "include",
    headers: getAuthHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function returnTo(taskId: number, toUserId: string, comment: string) {
  const r = await fetch(`/api/workflows/${taskId}/return`, {
    method: "POST", 
    credentials: "include",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ toUserId, comment }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function approve(taskId: number) {
  const r = await fetch(`/api/workflows/${taskId}/approve`, { 
    method: "POST", 
    credentials: "include",
    headers: getAuthHeaders()
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function reject(taskId: number, toUserId: string, comment: string) {
  const r = await fetch(`/api/workflows/${taskId}/reject`, {
    method: "POST", 
    credentials: "include",
    headers: { 
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ toUserId, comment }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}