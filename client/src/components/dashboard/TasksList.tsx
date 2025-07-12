import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { useQuery } from '@tanstack/react-query';
import { Calendar, User } from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

export function TasksList() {
  const { t } = useI18n();
  
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['/api/tasks'],
  });

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return t('status.urgent');
      case 'high':
        return t('status.high');
      case 'medium':
        return t('status.medium');
      case 'low':
        return t('status.low');
      default:
        return priority;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            {t('dashboard.upcomingTasks')}
          </CardTitle>
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-12" />
              </div>
              <Skeleton className="h-3 w-24 mb-2" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const upcomingTasks = tasks?.filter((task: any) => 
    task.status === 'todo' || task.status === 'in-progress'
  ).slice(0, 3) || [];

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">
          {t('dashboard.upcomingTasks')}
        </CardTitle>
        <Link href="/tasks">
          <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
            {t('actions.viewAll')}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingTasks.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            No upcoming tasks. You're all caught up!
          </div>
        ) : (
          upcomingTasks.map((task: any) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <div className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-sm text-slate-800 truncate">
                  {task.title}
                </p>
                <Badge 
                  variant={getPriorityBadgeVariant(task.priority)}
                  className="text-xs"
                >
                  {getPriorityText(task.priority)}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-2">
                Project: {task.projectId || 'Unassigned'}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400 flex items-center">
                  <User className="h-3 w-3 mr-1" />
                  {t('common.assignedTo')}: {task.assigneeId || 'Unassigned'}
                </p>
                <p className="text-xs text-slate-500 flex items-center">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(task.dueDate)}
                </p>
              </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
