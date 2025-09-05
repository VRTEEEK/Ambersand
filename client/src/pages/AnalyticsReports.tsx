import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterSelector, type AnalyticsFilters } from "@/components/analytics/FilterSelector";
import { fetchTaskMetrics } from "@/lib/analyticsApi";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";

export default function AnalyticsReports() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    projectIds: [],
    regulationIds: [],
    dateFrom: undefined,
    dateTo: undefined,
  });

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/tasks', filters],
    queryFn: () => fetchTaskMetrics({
      projectIds: filters.projectIds,
      regulationIds: filters.regulationIds,
      dateFrom: filters.dateFrom?.toISOString().split('T')[0],
      dateTo: filters.dateTo?.toISOString().split('T')[0],
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error loading analytics data. Please try again.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Prepare data for charts
  const statusData = metrics ? Object.entries(metrics.totals.byStatus).map(([status, count]) => ({
    status: status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count
  })) : [];

  const projectData = metrics?.byProject.slice(0, 10) || []; // Top 10 projects
  const regulationData = metrics?.byRegulation || [];
  const assigneeData = metrics?.byAssignee.slice(0, 8) || []; // Top 8 assignees
  const severityData = metrics?.bySeverity || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground">
            Task and compliance analytics with real-time insights
          </p>
        </div>
        <FilterSelector 
          filters={filters} 
          onFiltersChange={setFilters}
          className="w-auto"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metrics?.totals.all || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              All tasks in selected scope
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{metrics?.totals.overdue || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Past due date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{metrics?.totals.completedToday || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Finished today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {(metrics?.totals.byStatus['in-progress'] || 0) + (metrics?.totals.byStatus['review'] || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Active work
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Task Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Task Status Distribution</CardTitle>
            <CardDescription>Breakdown of tasks by current status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Project */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Project</CardTitle>
            <CardDescription>Task distribution across projects</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projectData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0088FE" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Regulation */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Regulation</CardTitle>
            <CardDescription>Compliance task distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regulationData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="code" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tasks by Assignee */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Assignee</CardTitle>
            <CardDescription>Workload distribution across team members</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={assigneeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FFBB28" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Priority/Severity Distribution */}
      <div className="grid gap-6 md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Task Priority Distribution</CardTitle>
            <CardDescription>Tasks categorized by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={severityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="severity" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF8042" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span>Date Range:</span>
                <span>
                  {filters.dateFrom ? filters.dateFrom.toLocaleDateString() : 'All time'} - {' '}
                  {filters.dateTo ? filters.dateTo.toLocaleDateString() : 'Present'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Filtered Projects:</span>
                <span>{filters.projectIds.length > 0 ? filters.projectIds.length : 'All'}</span>
              </div>
              <div className="flex justify-between">
                <span>Filtered Regulations:</span>
                <span>{filters.regulationIds.length > 0 ? filters.regulationIds.length : 'All'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}