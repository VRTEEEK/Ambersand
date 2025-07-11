import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { isUnauthorizedError } from '@/lib/authUtils';
import AppLayout from '@/components/layout/AppLayout';
import { MetricsCard } from '@/components/dashboard/MetricsCard';
import { ComplianceChart } from '@/components/dashboard/ComplianceChart';
import { RegulationStatus } from '@/components/dashboard/RegulationStatus';
import { ProjectsList } from '@/components/dashboard/ProjectsList';
import { TasksList } from '@/components/dashboard/TasksList';

import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  FolderOpen, 
  ListTodo, 
  BookOpen,
  TrendingUp,
  Clock,
} from 'lucide-react';

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();

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

  const { data: metrics, isLoading: metricsLoading, error } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
    retry: false,
  });

  // Handle API errors
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
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
  }, [error, toast]);

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
    return null; // Will redirect to login
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
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
                value={`${metrics?.overallCompliance || 0}%`}
                trend={{
                  value: "+5% from last month",
                  isPositive: true,
                }}
                icon={Shield}
                progress={metrics?.overallCompliance || 0}
              />
              
              <MetricsCard
                title={t('dashboard.activeProjects')}
                value={metrics?.activeProjects || 0}
                subtitle="8 on track, 4 overdue"
                icon={FolderOpen}
              />
              
              <MetricsCard
                title={t('dashboard.pendingTasks')}
                value={metrics?.pendingTasks || 0}
                trend={{
                  value: "6 urgent",
                  isPositive: false,
                }}
                icon={ListTodo}
              />
              
              <MetricsCard
                title={t('dashboard.regulations')}
                value={`${metrics?.regulationsCovered || 0}/5`}
                subtitle="ECC, PDPL, NDMO"
                icon={BookOpen}
              />
            </>
          )}
        </div>

        {/* Charts and Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComplianceChart 
            data={metrics?.complianceTrend || []}
          />
          <RegulationStatus 
            regulations={metrics?.regulationStatus || []}
          />
        </div>

        {/* Projects and ListTodo Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProjectsList />
          </div>
          <TasksList />
        </div>


      </div>
    </AppLayout>
  );
}
