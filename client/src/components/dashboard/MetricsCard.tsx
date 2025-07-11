import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  progress?: number;
  className?: string;
}

export function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  className,
}: MetricsCardProps) {
  return (
    <Card className={cn("glass-card hover-lift", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600">{title}</p>
            <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
            
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
            
            {trend && (
              <p className={cn(
                "text-sm flex items-center mt-1",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}>
                <span className="mr-1">
                  {trend.isPositive ? "↑" : "↓"}
                </span>
                {trend.value}
              </p>
            )}
          </div>
          
          <div className="relative">
            {progress !== undefined ? (
              <div className="relative">
                <svg className="w-16 h-16">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="#E2E8F0"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    stroke="#4A9B9B"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(progress / 100) * 175.9} 175.9`}
                    strokeDashoffset="0"
                    className="progress-ring"
                    style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
                  />
                </svg>
                {Icon && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icon className="text-teal-500 h-6 w-6" />
                  </div>
                )}
              </div>
            ) : Icon ? (
              <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                <Icon className="text-teal-500 h-6 w-6" />
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
