export async function downloadTemplate() {
  const r = await fetch("/api/admin/regulations/template.csv", { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  return blob;
}

export async function getVersions(code: string) {
  const r = await fetch(`/api/admin/regulations/${encodeURIComponent(code)}/versions`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // [{version,status,createdAt},...]
}

export async function importRegulation(formData: FormData, { dryRun }: { dryRun: boolean }) {
  const r = await fetch(`/api/admin/regulations/import?dryRun=${dryRun ? "1" : "0"}`, {
    method: "POST",
    credentials: "include",
    body: formData
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // {inserted,updated,total,warnings,errors,sample?}
}

// New functions for editable regulations system
export async function getRegulation(id: number) {
  const r = await fetch(`/api/regulations/${id}`, { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { regulation, controls }
}

export async function patchRegulation(id: number, data: any) {
  const r = await fetch(`/api/regulations/${id}`, {
    method: "PATCH", 
    credentials: "include",
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function patchControl(regId: number, controlId: number, data: any) {
  const r = await fetch(`/api/regulations/${regId}/controls/${controlId}`, {
    method: "PATCH", 
    credentials: "include",
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}