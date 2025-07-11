import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/hooks/use-i18n';
import { cn } from '@/lib/utils';

interface RegulationStatusProps {
  regulations: Array<{
    name: string;
    nameAr: string;
    progress: number;
    total: number;
    percentage: number;
  }>;
}

export function RegulationStatus({ regulations }: RegulationStatusProps) {
  const { t, language } = useI18n();

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-teal-600';
    if (percentage >= 40) return 'text-orange-600';
    return 'text-yellow-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-teal-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {t('dashboard.regulationStatus')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {regulations.map((regulation, index) => (
          <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center flex-1">
              <div className={cn("w-3 h-3 rounded-full mr-3", getProgressColor(regulation.percentage))} />
              <div className="flex-1">
                <p className="font-medium text-slate-800">
                  {language === 'ar' ? regulation.nameAr : regulation.name}
                </p>
                <p className="text-sm text-slate-500">
                  {regulation.progress} of {regulation.total} controls completed
                </p>
                <Progress 
                  value={regulation.percentage} 
                  className="mt-2 h-2"
                />
              </div>
            </div>
            <div className="text-right ml-4">
              <p className={cn("text-lg font-semibold", getStatusColor(regulation.percentage))}>
                {regulation.percentage}%
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
