import { apiRequest } from "@/lib/queryClient";

export interface TaskMetrics {
  totals: {
    all: number;
    byStatus: Record<string, number>;
    overdue: number;
    completedToday: number;
  };
  byProject: Array<{
    projectId: number;
    name: string;
    count: number;
  }>;
  byRegulation: Array<{
    regulationId: string;
    code: string;
    count: number;
  }>;
  byAssignee: Array<{
    userId: string;
    name: string;
    count: number;
  }>;
  bySeverity: Array<{
    severity: string;
    count: number;
  }>;
  dateRange: {
    from?: string;
    to?: string;
  };
}

export interface AnalyticsFilters {
  projectIds?: number[];
  regulationIds?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchTaskMetrics(filters: AnalyticsFilters = {}): Promise<TaskMetrics> {
  const searchParams = new URLSearchParams();
  
  if (filters.projectIds && filters.projectIds.length > 0) {
    searchParams.set('projectIds', filters.projectIds.join(','));
  }
  
  if (filters.regulationIds && filters.regulationIds.length > 0) {
    searchParams.set('regulationIds', filters.regulationIds.join(','));
  }
  
  if (filters.dateFrom) {
    searchParams.set('dateFrom', filters.dateFrom);
  }
  
  if (filters.dateTo) {
    searchParams.set('dateTo', filters.dateTo);
  }

  const url = `/api/analytics/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch analytics: ${response.statusText}`);
  }
  
  return response.json();
}