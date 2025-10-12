export async function createProject(payload: { name: string; description?: string; regulationId: number; controlIds: number[] }) {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const r = await fetch(`/api/projects`, {
    method: "POST", 
    credentials: "include",
    headers,
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { projectId }
}

export async function getProjectControls(projectId: number) {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const r = await fetch(`/api/projects/${projectId}/controls`, { 
    credentials: "include",
    headers
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}