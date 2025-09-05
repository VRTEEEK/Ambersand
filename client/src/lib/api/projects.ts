export async function createProject(payload: { name: string; description?: string; regulationId: number; controlIds: number[] }) {
  const r = await fetch(`/api/projects`, {
    method: "POST", 
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { projectId }
}

export async function getProjectControls(projectId: number) {
  const r = await fetch(`/api/projects/${projectId}/controls`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}