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

  // Calculate percentages for donut chart segments
  const completedPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const inProgressPercentage = totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0;
  const reviewPercentage = totalTasks > 0 ? (reviewTasks / totalTasks) * 100 : 0;
  const pendingPercentage = totalTasks > 0 ? (pendingTasks / totalTasks) * 100 : 0;

  // Create donut chart component
  const DonutChart = ({ size = 280 }: { size?: number }) => {
    const radius = (size - 60) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeWidth = 40;
    
    // Calculate cumulative percentages for positioning
    const completedOffset = 0;
    const inProgressOffset = completedPercentage;
    const reviewOffset = completedPercentage + inProgressPercentage;
    const pendingOffset = completedPercentage + inProgressPercentage + reviewPercentage;

    const createPath = (percentage: number, offset: number) => {
      const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -(offset / 100) * circumference;
      
      return { strokeDasharray, strokeDashoffset };
    };

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
            className="dark:stroke-gray-700"
          />
          
          {/* Completed segment */}
          {completedPercentage > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#2699A6"
              strokeWidth={strokeWidth}
              fill="none"
              {...createPath(completedPercentage, completedOffset)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
          
          {/* In Progress segment */}
          {inProgressPercentage > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#3B82F6"
              strokeWidth={strokeWidth}
              fill="none"
              {...createPath(inProgressPercentage, inProgressOffset)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
          
          {/* Review segment */}
          {reviewPercentage > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#F59E0B"
              strokeWidth={strokeWidth}
              fill="none"
              {...createPath(reviewPercentage, reviewOffset)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
          
          {/* Pending segment */}
          {pendingPercentage > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#9CA3AF"
              strokeWidth={strokeWidth}
              fill="none"
              {...createPath(pendingPercentage, pendingOffset)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
            {Math.round(completedPercentage)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {language === 'ar' ? 'مكتمل' : 'Completed'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {completedTasks} {language === 'ar' ? 'من' : 'of'} {totalTasks} {language === 'ar' ? 'مهمة' : 'tasks'}
          </div>
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
        <Target className="h-5 w-5" style={{ color: '#2699A6' }} />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Main Donut Chart */}
          <div className="flex flex-col items-center">
            <DonutChart size={300} />
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-4">
            {/* Completed */}
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#2699A6' }}></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'ar' ? 'مكتملة' : 'Completed'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {completedTasks} ({Math.round(completedPercentage)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* In Progress */}
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {inProgressTasks} ({Math.round(inProgressPercentage)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Review */}
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'ar' ? 'للمراجعة' : 'Review'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {reviewTasks} ({Math.round(reviewPercentage)}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Pending */}
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-gray-400"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {language === 'ar' ? 'لم تبدأ' : 'Pending'}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {pendingTasks} ({Math.round(pendingPercentage)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}