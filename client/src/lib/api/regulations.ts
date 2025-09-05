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