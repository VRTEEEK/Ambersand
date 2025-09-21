import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Shield, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'wouter';
import { Skeleton } from '@/components/ui/skeleton';

interface DomainStats {
  nameEn: string;
  nameAr: string;
  completed: number;
  total: number;
  percentage: number;
}

interface RegulationData {
  id: number;
  code: string;
  nameEn: string;
  nameAr: string;
  version: string;
  publisher: string;
  logoUrl?: string;
  domains: DomainStats[];
}

export function DynamicRegulationCards() {
  const { language, t } = useI18n();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const toggleCardExpansion = (regulationId: number) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(regulationId)) {
        newSet.delete(regulationId);
      } else {
        newSet.add(regulationId);
      }
      return newSet;
    });
  };

  const { data: regulations, isLoading } = useQuery<RegulationData[]>({
    queryKey: ['/api/dashboard/regulations'],
    queryFn: () => fetch('/api/dashboard/regulations').then(res => res.json()),
    staleTime: 0,
    gcTime: 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-2xl">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <Skeleton className="h-20 w-20 rounded-2xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-24 rounded-lg" />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const isRTL = language === 'ar';

  return (
    <div className="space-y-6">
      {/* Regulation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {regulations?.map((regulation) => {
          const isExpanded = expandedCards.has(regulation.id);
          const totalCompleted = regulation.domains.reduce((sum, domain) => sum + domain.completed, 0);
          const totalControls = regulation.domains.reduce((sum, domain) => sum + domain.total, 0);
          const overallPercentage = totalControls > 0 ? Math.round((totalCompleted / totalControls) * 100) : 0;
          
          return (
            <Card key={regulation.id} className="bg-card border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer group overflow-hidden">
              <CardContent className="p-0">
                {/* Main Card Content - Always Visible */}
                <button 
                  className="w-full p-6 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleCardExpansion(regulation.id);
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${language === 'ar' ? 'تبديل تفاصيل' : 'Toggle details for'} ${language === 'ar' ? regulation.nameAr : regulation.nameEn}`}
                  data-testid={`regulation-card-${regulation.id}`}
                >
                  <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* Left Side: Icon and Title */}
                    <div className={`flex items-center gap-4 flex-1 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Regulation Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                          {regulation.logoUrl ? (
                            <img
                              src={regulation.logoUrl}
                              alt={regulation.nameEn}
                              className="w-6 h-6 object-contain"
                            />
                          ) : (
                            <Shield className="w-6 h-6 text-primary" />
                          )}
                        </div>
                      </div>

                      {/* Title and Progress */}
                      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-300 truncate text-base leading-tight">
                          {language === 'ar' ? regulation.nameAr : regulation.nameEn}
                        </h3>
                        <div className={`flex items-center gap-2 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <Badge variant="outline" className="text-xs px-2 py-0.5 font-medium">
                            {regulation.code}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {totalCompleted}/{totalControls} controls
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Progress and Expand Button */}
                    <div className={`flex items-center gap-3 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Progress Circle */}
                      <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="stroke-muted-foreground/20"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            strokeWidth="2"
                            strokeDasharray="100, 100"
                          />
                          <path
                            className="stroke-primary transition-all duration-300"
                            d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            strokeWidth="2"
                            strokeDasharray={`${overallPercentage}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-semibold text-foreground">
                            {overallPercentage}%
                          </span>
                        </div>
                      </div>

                      {/* Expand/Collapse Icon */}
                      <div className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Content - Domain Progress */}
                {isExpanded && (
                  <div className="border-t border-border/50 bg-muted/30 transition-all duration-300">
                    <div className="p-6 pt-4">
                      <div className="space-y-4">
                        <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <h4 className="text-sm font-medium text-foreground">
                            {language === 'ar' ? 'تقدم المجالات' : 'Domain Progress'}
                          </h4>
                          <Link href={`/regulations/${regulation.id}`}>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-xs h-7 px-3"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`view-regulation-${regulation.id}`}
                            >
                              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            </Button>
                          </Link>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          {regulation.domains.map((domain) => (
                            <div key={domain.nameEn} className="bg-background rounded-lg p-3 border border-border/50">
                              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {language === 'ar' ? domain.nameAr : domain.nameEn}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {domain.completed}/{domain.total} controls completed
                                  </p>
                                </div>
                                <div className={`flex items-center gap-2 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <span className="text-sm font-semibold text-primary">
                                    {domain.percentage}%
                                  </span>
                                  <div className="w-16 bg-muted rounded-full h-2">
                                    <div
                                      className="bg-primary rounded-full h-2 transition-all duration-500"
                                      style={{ width: `${Math.min(100, domain.percentage)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add More Regulations Card */}
      <Card className="border-2 border-dashed border-primary/30 bg-card rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group hover:border-primary/50">
        <CardContent className="p-10">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-200">
              <Plus className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-foreground">
                {language === 'ar' ? 'إضافة المزيد من الأنظمة' : 'Add more regulations'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {language === 'ar'
                  ? 'استخدم أداة الاستيراد لإضافة أنظمة جديدة من ملفات Excel'
                  : 'Use the import tool to add new regulations from Excel files'
                }
              </p>
            </div>
            <Link href="/regulations">
              <Button variant="outline" className="mt-6 px-6 py-3 font-medium">
                {language === 'ar' ? 'إدارة الأنظمة' : 'Manage Regulations'}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {regulations && regulations.length === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-12 text-center">
            <div className="space-y-6">
              <div className="w-24 h-24 mx-auto bg-muted rounded-2xl flex items-center justify-center">
                <FileText className="w-12 h-12 text-muted-foreground" />
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-foreground">
                  {language === 'ar' ? 'لا توجد أنظمة متاحة' : 'No regulations available'}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {language === 'ar'
                    ? 'ابدأ بإضافة أنظمة الامتثال لتتمكن من تتبع التقدم وإدارة المتطلبات'
                    : 'Start by adding compliance regulations to track progress and manage requirements'
                  }
                </p>
              </div>
              <Link href="/regulations">
                <Button className="px-6 py-3 font-medium">
                  <Plus className="w-4 h-4 mr-2" />
                  {language === 'ar' ? 'إضافة نظام' : 'Add Regulation'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}