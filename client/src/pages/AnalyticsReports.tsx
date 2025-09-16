import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/lib/authUtils';
import heroBackgroundPath from "@assets/image_1752308988455.png";
import AppLayout from '@/components/layout/AppLayout';
import { MetricsCard } from '@/components/dashboard/MetricsCard';
import { ComplianceChart } from '@/components/dashboard/ComplianceChart';
import { RegulationStatus } from '@/components/dashboard/RegulationStatus';
import { ProjectsList } from '@/components/dashboard/ProjectsList';
import { TasksList } from '@/components/dashboard/TasksList';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  FolderOpen, 
  ListTodo, 
  BookOpen,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

// Analytics imports
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterSelector, type AnalyticsFilters } from "@/components/analytics/FilterSelector";
import { fetchTaskMetrics } from "@/lib/analyticsApi";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

export default function AnalyticsReports() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Analytics filters state
  const [filters, setFilters] = useState<AnalyticsFilters>({
    projectIds: [],
    regulationIds: [],
    dateFrom: undefined,
    dateTo: undefined,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Dashboard metrics query
  const { data: metrics, isLoading: metricsLoading, error } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    retry: false,
  });

  // Analytics metrics query
  const { data: analyticsMetrics, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ['/api/analytics/tasks', filters],
    queryFn: () => fetchTaskMetrics({
      projectIds: filters.projectIds,
      regulationIds: filters.regulationIds,
      dateFrom: filters.dateFrom?.toISOString().split('T')[0],
      dateTo: filters.dateTo?.toISOString().split('T')[0],
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Handle API errors
  useEffect(() => {
    if ((error && isUnauthorizedError(error as Error)) || (analyticsError && isUnauthorizedError(analyticsError as Error))) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [error, analyticsError, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (analyticsError && activeTab === 'analytics') {
    return (
      <AppLayout>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-600">
              Error loading analytics data. Please try again.
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  // Chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Prepare data for analytics charts
  const statusData = analyticsMetrics ? Object.entries(analyticsMetrics.totals.byStatus).map(([status, count]) => ({
    status: status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count
  })) : [];

  const projectData = analyticsMetrics?.byProject.slice(0, 10) || []; // Top 10 projects
  const regulationData = analyticsMetrics?.byRegulation || [];
  const assigneeData = analyticsMetrics?.byAssignee.slice(0, 8) || []; // Top 8 assignees
  const severityData = analyticsMetrics?.bySeverity || [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Overview and Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger 
              value="overview"
              className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}
            >
              <BarChart3 className="w-4 h-4" />
              {language === 'ar' ? 'النظرة العامة' : 'Overview'}
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className={`flex items-center gap-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}
            >
              <TrendingUp className="w-4 h-4" />
              {language === 'ar' ? 'التحليلات' : 'Analytics'}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - KPI Heavy View */}
          <TabsContent value="overview" className="space-y-8">
            {/* Hero Section with Background */}
            <div 
              className="relative overflow-hidden rounded-2xl"
              style={{
                backgroundImage: `url(${heroBackgroundPath})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-teal-600/90 via-teal-700/80 to-teal-800/90"></div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metricsLoading ? (
                // Loading skeletons
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16 mb-1" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="w-12 h-12 rounded-lg" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <MetricsCard
                    title={t('dashboard.overallCompliance')}
                    value={`${(metrics as any)?.overallCompliance || 0}%`}
                    trend={{
                      value: "+5% from last month",
                      isPositive: true,
                    }}
                    icon={Shield}
                    progress={(metrics as any)?.overallCompliance || 0}
                  />
                  
                  <MetricsCard
                    title={t('dashboard.activeProjects')}
                    value={(metrics as any)?.activeProjects || 0}
                    subtitle="8 on track, 4 overdue"
                    icon={FolderOpen}
                  />
                  
                  <MetricsCard
                    title={t('dashboard.pendingTasks')}
                    value={(metrics as any)?.pendingTasks || 0}
                    trend={{
                      value: "6 urgent",
                      isPositive: false,
                    }}
                    icon={ListTodo}
                  />
                  
                  <MetricsCard
                    title={t('dashboard.regulations')}
                    value={`${(metrics as any)?.regulationsCovered || 0}/5`}
                    subtitle="ECC, PDPL, NDMO"
                    icon={BookOpen}
                  />
                </>
              )}
            </div>

            {/* Charts and Analytics Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ComplianceChart 
                data={(metrics as any)?.complianceTrend || []}
              />
              <RegulationStatus 
                regulations={(metrics as any)?.regulationStatus || []}
              />
            </div>

            {/* Projects and Tasks Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ProjectsList />
              </div>
              <TasksList />
            </div>
          </TabsContent>

          {/* Analytics Tab - Detailed Analytics View */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
                <p className="text-muted-foreground">
                  Task and compliance analytics with real-time insights
                </p>
              </div>
            </div>

            {/* Filters */}
            <FilterSelector filters={filters} onFiltersChange={setFilters} />

            {analyticsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-12 mb-2" />
                      <Skeleton className="h-4 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{analyticsMetrics?.totals.all || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        Across all projects
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {analyticsMetrics?.totals.byStatus.completed || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {analyticsMetrics?.totals.all ? 
                          Math.round((analyticsMetrics.totals.byStatus.completed / analyticsMetrics.totals.all) * 100) 
                          : 0}% completion rate
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                      <Clock className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {analyticsMetrics?.totals.byStatus['in-progress'] || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Active work items
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">High Priority</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {analyticsMetrics?.bySeverity.find(s => s.severity === 'high')?.count || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Urgent attention needed
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Task Status Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Task Status Distribution</CardTitle>
                      <CardDescription>
                        Breakdown of tasks by current status
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={statusData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({status, percent}) => `${status} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="count"
                            >
                              {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasks by Project */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Tasks by Project</CardTitle>
                      <CardDescription>
                        Top 10 projects by task count
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={projectData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="projectName" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="taskCount" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasks by Regulation */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Tasks by Regulation</CardTitle>
                      <CardDescription>
                        Distribution across compliance frameworks
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={regulationData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="regulationName" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="taskCount" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasks by Assignee */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Tasks by Assignee</CardTitle>
                      <CardDescription>
                        Workload distribution among team members
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={assigneeData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="assigneeName" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                            />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="taskCount" fill="#ffc658" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Task Severity Distribution */}
                {severityData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Task Priority Distribution</CardTitle>
                      <CardDescription>
                        Tasks categorized by severity levels
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={severityData} layout="horizontal">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="severity" type="category" />
                            <Tooltip />
                            <Bar dataKey="count" fill="#ff7300" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}