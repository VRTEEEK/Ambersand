import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, User } from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

export function ProjectsList() {
  const { t } = useI18n();
  
  const { data: projects, isLoading } = useQuery({
    queryKey: ['/api/projects'],
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      case 'planning':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return t('status.active');
      case 'completed':
        return t('status.completed');
      case 'overdue':
        return t('status.overdue');
      case 'planning':
        return t('status.planning');
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            {t('dashboard.recentProjects')}
          </CardTitle>
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Skeleton className="w-10 h-10 rounded-lg mr-4" />
                  <div>
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-6 w-16 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const recentProjects = projects?.slice(0, 3) || [];

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">
          {t('dashboard.recentProjects')}
        </CardTitle>
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700">
            {t('actions.viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {recentProjects.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            No projects found. Create your first project to get started.
          </div>
        ) : (
          recentProjects.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              
              <div className="flex items-center">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center mr-4">
                  <Calendar className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{project.name}</p>
                  <p className="text-sm text-slate-500 truncate max-w-xs">
                    {project.description || 'No description available'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center">
                    <User className="h-3 w-3 mr-1" />
                    {project.ownerId}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={getStatusBadgeVariant(project.status)}>
                  {getStatusText(project.status)}
                </Badge>
                <p className="text-sm text-slate-500 mt-1">
                  {project.progress || 0}% complete
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
