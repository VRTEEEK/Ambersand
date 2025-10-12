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

  const { data: regulations, isLoading, isError } = useQuery<RegulationData[]>({
    queryKey: ['/api/dashboard/regulations'],
    queryFn: async () => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch('/api/dashboard/regulations', { headers });
      if (!res.ok) {
        throw new Error('Failed to fetch regulations');
      }
      const data = await res.json();
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
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

  // Ensure regulations is always an array
  const regulationList = Array.isArray(regulations) ? regulations : [];

  return (
    <div className="space-y-6">
      {/* Regulation Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regulationList.map((regulation) => {
          const isExpanded = expandedCards.has(regulation.id);
          const totalCompleted = regulation.domains.reduce((sum, domain) => sum + domain.completed, 0);
          const totalControls = regulation.domains.reduce((sum, domain) => sum + domain.total, 0);
          const overallPercentage = totalControls > 0 ? Math.round((totalCompleted / totalControls) * 100) : 0;
          
          return (
            <Card 
              key={regulation.id} 
              className="relative bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 border-2 border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 cursor-pointer group overflow-hidden backdrop-blur-sm"
            >
              <CardContent className="p-0">
                {/* Decorative Top Bar */}
                <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60"></div>
                
                {/* Main Card Content - Always Visible */}
                <button 
                  className="w-full p-8 transition-all duration-300 text-left focus:outline-none focus:ring-4 focus:ring-primary/20 group-hover:bg-white/50 dark:group-hover:bg-gray-800/50"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleCardExpansion(regulation.id);
                  }}
                  aria-expanded={isExpanded}
                  aria-label={`${language === 'ar' ? 'تبديل تفاصيل' : 'Toggle details for'} ${language === 'ar' ? regulation.nameAr : regulation.nameEn}`}
                  data-testid={`regulation-card-${regulation.id}`}
                >
                  <div className="space-y-6">
                    {/* Header Section */}
                    <div className={`flex items-start gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Icon Container */}
                      <div className="flex-shrink-0">
                        <div className="relative w-16 h-16 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-500">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          {regulation.logoUrl ? (
                            <img
                              src={regulation.logoUrl}
                              alt={regulation.nameEn}
                              className="relative z-10 w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110"
                            />
                          ) : (
                            <Shield className="relative z-10 w-8 h-8 text-primary transition-transform duration-300 group-hover:scale-110" />
                          )}
                        </div>
                      </div>

                      {/* Title Section */}
                      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors duration-300 leading-tight">
                              {language === 'ar' ? regulation.nameAr : regulation.nameEn}
                            </h3>
                            <div className={`flex items-center gap-3 mt-2 ${isRTL ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                              <Badge 
                                variant="secondary" 
                                className="bg-primary/10 text-primary border-primary/20 font-semibold px-3 py-1.5 rounded-lg"
                              >
                                {regulation.code}
                              </Badge>
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {regulation.publisher}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      {/* Progress Stats */}
                      <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {totalCompleted}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {language === 'ar' ? 'مكتمل' : 'Completed'}
                          </div>
                        </div>
                        <div className="text-gray-300 dark:text-gray-600 text-xl font-light">/</div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                            {totalControls}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {language === 'ar' ? 'إجمالي' : 'Total'}
                          </div>
                        </div>
                      </div>

                      {/* Circular Progress */}
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="stroke-gray-200 dark:stroke-gray-700"
                              d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              strokeWidth="3"
                              strokeDasharray="100, 100"
                            />
                            <path
                              className="stroke-primary transition-all duration-700 ease-out"
                              d="M18 2.0845
                                a 15.9155 15.9155 0 0 1 0 31.831
                                a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              strokeWidth="3"
                              strokeDasharray={`${overallPercentage}, 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-lg font-bold text-primary">
                              {overallPercentage}%
                            </span>
                          </div>
                        </div>

                        {/* Expand Icon */}
                        <div className="text-gray-400 group-hover:text-primary transition-colors duration-300">
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6" />
                          ) : (
                            <ChevronDown className="w-6 h-6" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          {language === 'ar' ? 'التقدم الإجمالي' : 'Overall Progress'}
                        </span>
                        <span className="text-primary font-semibold">
                          {overallPercentage}%
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out rounded-full"
                          style={{ width: `${overallPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Content - Domain Progress */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-800/50 dark:to-gray-900/50 transition-all duration-500">
                    <div className="p-8 pt-6">
                      <div className="space-y-6">
                        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {language === 'ar' ? 'تقدم المجالات' : 'Domain Progress'}
                          </h4>
                          <Link href={`/regulations/${regulation.id}`}>
                            <Button 
                              variant="default"
                              size="sm" 
                              className="bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 px-6 py-2"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`view-regulation-${regulation.id}`}
                            >
                              {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                            </Button>
                          </Link>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-4">
                          {regulation.domains.map((domain, index) => (
                            <div 
                              key={domain.nameEn} 
                              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300"
                              style={{
                                animationDelay: `${index * 100}ms`,
                                animation: 'fadeInUp 0.5s ease-out forwards'
                              }}
                            >
                              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                    {language === 'ar' ? domain.nameAr : domain.nameEn}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {domain.completed} {language === 'ar' ? 'من' : 'of'} {domain.total} {language === 'ar' ? 'عنصر مكتمل' : 'controls completed'}
                                  </p>
                                </div>
                                <div className={`flex items-center gap-4 flex-shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                                  <span className="text-lg font-bold text-primary">
                                    {domain.percentage}%
                                  </span>
                                  <div className="w-20 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                    <div
                                      className="bg-gradient-to-r from-primary to-primary/80 rounded-full h-3 transition-all duration-1000 ease-out"
                                      style={{ 
                                        width: `${Math.min(100, domain.percentage)}%`,
                                        animationDelay: `${index * 200 + 300}ms`
                                      }}
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
      {regulationList.length === 0 && (
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