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
import { DynamicRegulationCards } from '@/components/dashboard/DynamicRegulationCards';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  FolderOpen,
  ListTodo,
  BookOpen,
  TrendingUp,
  Clock,
  BarChart3,
  FileText,
} from 'lucide-react';

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("regulations");

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
        {/* Dashboard Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-foreground">
            {language === 'ar' ? 'لوحة الامتثال' : 'Compliance Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar'
              ? 'عرض شامل لحالة الامتثال للأنظمة المختلفة'
              : 'Comprehensive view of your compliance status across regulations'
            }
          </p>
        </div>

        {/* Dynamic Regulations Cards */}
        <DynamicRegulationCards />
      </div>
    </AppLayout>
  );
}
