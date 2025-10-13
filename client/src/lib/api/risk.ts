import { apiRequest } from "@/lib/queryClient";

export type RiskStatus = "not-started" | "in-progress" | "mitigated" | "under-review" | "completed";
export type RiskSeverity = "low" | "medium" | "high" | "critical" | "urgent";

export interface RiskItem {
  id: number;
  organizationId: string;
  taskId: number;
  assigneeId?: string | null;
  title: string;
  riskDescription?: string | null;
  mitigationPlan?: string | null;
  status: RiskStatus;
  severity: RiskSeverity;
  isOpen: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
}

// API functions
export async function listRisks(params: URLSearchParams) {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`/api/risks?${params.toString()}`, { 
    credentials: "include",
    headers 
  });
  if (!res.ok) throw new Error("Failed to list risks");
  return res.json();
}

export async function getRisk(id: number): Promise<RiskItem> {
  const token = localStorage.getItem("accessToken");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`/api/risks/${id}`, { 
    credentials: "include",
    headers 
  });
  if (!res.ok) throw new Error("Failed to get risk");
  return res.json();
}

export async function toggleRisk(taskId: number, makeRisk: boolean) {
  const res = await apiRequest(`/api/risks/toggle`, "POST", { taskId, makeRisk });
  return res.json();
}

export async function updateRisk(id: number, patch: Partial<RiskItem>) {
  const res = await apiRequest(`/api/risks/${id}`, "PATCH", patch);
  return res.json();
}

// Helper functions for UI
export function getSeverityColor(severity: RiskSeverity): string {
  switch (severity) {
    case "low": return "text-gray-600 bg-gray-100";
    case "medium": return "text-amber-600 bg-amber-100";
    case "high": return "text-orange-600 bg-orange-100";
    case "critical": return "text-red-600 bg-red-100";
    case "urgent": return "text-rose-600 bg-rose-100";
    default: return "text-gray-600 bg-gray-100";
  }
}

export function getStatusColor(status: RiskStatus): string {
  switch (status) {
    case "not-started": return "text-slate-600 bg-slate-100";
    case "in-progress": return "text-blue-600 bg-blue-100";
    case "mitigated": return "text-emerald-600 bg-emerald-100";
    case "under-review": return "text-violet-600 bg-violet-100";
    case "completed": return "text-green-600 bg-green-100";
    default: return "text-slate-600 bg-slate-100";
  }
}