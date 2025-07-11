import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/hooks/use-i18n';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, Target } from 'lucide-react';

interface Task {
  id: number;
  title: string;
  titleAr?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assigneeId?: string;
  projectId?: number;
  createdAt: string;
  updatedAt: string;
}

interface ComplianceChartProps {
  data: Array<{ month: string; score: number }>;
}

export function ComplianceChart({ data }: ComplianceChartProps) {
  const { t, language } = useI18n();

  // Fetch tasks to calculate progress
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
  });

  // Calculate task progress statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
  const reviewTasks = tasks.filter(task => task.status === 'review').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;

  const completedPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const inProgressPercentage = totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0;
  const reviewPercentage = totalTasks > 0 ? Math.round((reviewTasks / totalTasks) * 100) : 0;
  const pendingPercentage = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;

  // Create circular progress component
  const CircularProgress = ({ percentage, color, size = 120 }: { percentage: number; color: string; size?: number }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth="4"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-in-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {percentage}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">
          {language === 'ar' ? 'تقدم المهام' : 'Task Progress'}
        </CardTitle>
        <Target className="h-5 w-5 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Progress Circle */}
          <div className="flex flex-col items-center space-y-2">
            <CircularProgress 
              percentage={completedPercentage} 
              color="#10B981" 
              size={140}
            />
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
              </p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {completedTasks} / {totalTasks}
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            {/* In Progress */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <CircularProgress 
                  percentage={inProgressPercentage} 
                  color="#3B82F6" 
                  size={60}
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {inProgressTasks} {language === 'ar' ? 'مهمة' : 'tasks'}
                  </p>
                </div>
              </div>
            </div>

            {/* Review */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <CircularProgress 
                  percentage={reviewPercentage} 
                  color="#F59E0B" 
                  size={60}
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {language === 'ar' ? 'للمراجعة' : 'Review'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {reviewTasks} {language === 'ar' ? 'مهمة' : 'tasks'}
                  </p>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <CircularProgress 
                  percentage={pendingPercentage} 
                  color="#6B7280" 
                  size={60}
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {language === 'ar' ? 'لم تبدأ' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {pendingTasks} {language === 'ar' ? 'مهمة' : 'tasks'}
                  </p>
                </div>
              </div>
            </div>

            {/* Completed */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <CircularProgress 
                  percentage={completedPercentage} 
                  color="#10B981" 
                  size={60}
                />
                <div>
                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {language === 'ar' ? 'مكتملة' : 'Completed'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {completedTasks} {language === 'ar' ? 'مهمة' : 'tasks'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {language === 'ar' ? 'إجمالي المهام' : 'Total Tasks'}
              </span>
              <Badge variant="outline" className="bg-white dark:bg-gray-800">
                {totalTasks}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}