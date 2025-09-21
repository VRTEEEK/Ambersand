import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Shield, FileText } from 'lucide-react';
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {regulations?.map((regulation) => (
          <Link key={regulation.id} href={`/regulations/${regulation.id}`}>
            <Card className="bg-card border-border rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group hover:scale-[1.02]">
              <CardContent className="p-8">
                <div className="space-y-6">
                  {/* Regulation Header */}
                  <div className={`flex items-center gap-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {/* Regulation Icon/Logo */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
                        {regulation.logoUrl ? (
                          <img
                            src={regulation.logoUrl}
                            alt={regulation.nameEn}
                            className="w-12 h-12 object-contain"
                          />
                        ) : (
                          <Shield className="w-10 h-10 text-primary" />
                        )}
                      </div>
                    </div>

                    {/* Title Section */}
                    <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <div className={`flex items-center gap-3 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                          {language === 'ar' ? regulation.nameAr : regulation.nameEn}
                        </h2>
                        <Badge variant="secondary" className="text-xs font-medium">
                          {regulation.code}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {regulation.publisher} • v{regulation.version}
                      </p>
                    </div>
                  </div>

                  {/* Domain Progress Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {regulation.domains.slice(0, 4).map((domain) => (
                      <Card key={domain.nameEn} className="bg-primary/8 border-primary/20 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                        <CardContent className="p-4 text-center">
                          <div className="space-y-3">
                            <div className="text-2xl font-bold text-primary transition-transform duration-200">
                              {domain.completed}/{domain.total}
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-foreground leading-tight">
                                {language === 'ar' ? domain.nameAr : domain.nameEn}
                              </p>
                              <div className="flex items-center justify-center gap-1">
                                <div className="text-xs text-muted-foreground">
                                  {domain.percentage}%
                                </div>
                                <div className="w-12 bg-muted rounded-full h-1.5">
                                  <div
                                    className="bg-primary rounded-full h-1.5 transition-all duration-300"
                                    style={{ width: `${Math.min(100, domain.percentage)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* More Domains Indicator */}
                  {regulation.domains.length > 4 && (
                    <div className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        {language === 'ar'
                          ? `+ ${regulation.domains.length - 4} مجالات أخرى`
                          : `+ ${regulation.domains.length - 4} more domains`
                        }
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
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