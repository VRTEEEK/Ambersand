import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  ListTodo, 
  Upload, 
  BarChart3,
} from 'lucide-react';
import { Link } from 'wouter';

export function QuickActions() {
  const { t } = useI18n();
  const { toast } = useToast();

  const actions = [
    {
      title: t('actions.createProject'),
      icon: Plus,
      href: '/projects/new',
      className: 'hover:bg-teal-50 hover:border-teal-200 group',
      iconBg: 'bg-teal-100 group-hover:bg-teal-200',
      iconColor: 'text-teal-600',
    },
    {
      title: t('actions.addTask'),
      icon: ListTodo,
      href: '/tasks/new',
      className: 'hover:bg-orange-50 hover:border-orange-200 group',
      iconBg: 'bg-orange-100 group-hover:bg-orange-200',
      iconColor: 'text-orange-600',
    },
    {
      title: t('actions.uploadEvidence'),
      icon: Upload,
      href: '/evidence/upload',
      className: 'hover:bg-blue-50 hover:border-blue-200 group',
      iconBg: 'bg-blue-100 group-hover:bg-blue-200',
      iconColor: 'text-blue-600',
    },
    {
      title: t('actions.generateReport'),
      icon: BarChart3,
      onClick: () => {
        toast({
          title: t('common.success'),
          description: 'Report generation started. You will be notified when it\'s ready.',
        });
      },
      className: 'hover:bg-purple-50 hover:border-purple-200 group',
      iconBg: 'bg-purple-100 group-hover:bg-purple-200',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('dashboard.quickActions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const content = (
              <div
                className={`flex flex-col items-center p-4 border border-slate-200 rounded-lg transition-colors cursor-pointer ${action.className}`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors ${action.iconBg}`}>
                  <Icon className={`h-6 w-6 ${action.iconColor}`} />
                </div>
                <span className="text-sm font-medium text-slate-700 text-center">
                  {action.title}
                </span>
              </div>
            );

            if (action.href) {
              return (
                <Link key={index} href={action.href}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={index} onClick={action.onClick}>
                {content}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
