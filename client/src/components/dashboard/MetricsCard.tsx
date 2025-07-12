import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import heroBackgroundPath from "@assets/image_1752308988455.png";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
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
  iconColor = '#2699A6',
  trend,
  progress,
  className,
}: MetricsCardProps) {
  return (
    <Card className={cn("relative overflow-hidden hover-lift border-0 shadow-lg", className)}>
      {/* Background Image */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${heroBackgroundPath})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-600/95 via-teal-700/90 to-teal-800/95"></div>
      
      <CardContent className="relative p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-white/90">{title}</p>
              {trend && (
                <span className={cn(
                  "text-xs flex items-center px-2 py-1 rounded-full backdrop-blur-sm font-medium",
                  trend.isPositive 
                    ? "text-green-200 bg-green-500/30" 
                    : "text-red-200 bg-red-500/30"
                )}>
                  <span className="mr-1">
                    {trend.isPositive ? "↗" : "↘"}
                  </span>
                  {trend.value}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-white">{value}</p>
            
            {subtitle && (
              <p className="text-sm text-white/80 mt-1">{subtitle}</p>
            )}
          </div>
          
          <div className="relative">
            {progress !== undefined ? (
              <div className="relative">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                  <svg className="w-12 h-12">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="3"
                      fill="none"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="white"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${(progress / 100) * 125.7} 125.7`}
                      strokeDashoffset="0"
                      className="progress-ring transition-all duration-500"
                      style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
                    />
                  </svg>
                  {Icon && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  )}
                </div>
              </div>
            ) : Icon ? (
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                <Icon className="h-6 w-6 text-white" />
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
