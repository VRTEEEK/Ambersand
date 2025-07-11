import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, BookOpen, Shield, Database } from 'lucide-react';

export default function Regulations() {
  const { t, language } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: controls, isLoading } = useQuery({
    queryKey: ['/api/ecc-controls', { search: searchTerm }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      if (params?.search) {
        searchParams.append('search', params.search);
      }
      const response = await fetch(`${url}?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch controls');
      return response.json();
    },
  });

  // Group controls by domain
  const groupedControls = controls?.reduce((acc: any, control: any) => {
    const domain = language === 'ar' ? control.domainAr : control.domainEn;
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(control);
    return acc;
  }, {}) || {};

  const regulationFrameworks = [
    {
      name: 'ECC (Essential Cybersecurity Controls)',
      nameAr: 'الضوابط الأساسية للأمن السيبراني',
      description: 'Saudi cybersecurity regulatory framework for critical infrastructure protection',
      descriptionAr: 'الإطار التنظيمي السعودي للأمن السيبراني لحماية البنى التحتية الحيوية',
      icon: Shield,
      color: 'teal',
      totalControls: controls?.length || 0,
      status: 'active',
    },
    {
      name: 'PDPL (Personal Data Protection Law)',
      nameAr: 'نظام حماية البيانات الشخصية',
      description: 'Saudi personal data protection and privacy regulations',
      descriptionAr: 'لوائح حماية البيانات الشخصية والخصوصية السعودية',
      icon: Database,
      color: 'orange',
      totalControls: 18,
      status: 'active',
    },
    {
      name: 'NDMO (National Data Management Office)',
      nameAr: 'مكتب إدارة البيانات الوطنية',
      description: 'National data governance and management requirements',
      descriptionAr: 'متطلبات حوكمة وإدارة البيانات الوطنية',
      icon: BookOpen,
      color: 'blue',
      totalControls: 25,
      status: 'planning',
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {t('nav.regulations')}
            </h1>
            <p className="text-slate-600 mt-1">
              {language === 'ar'
                ? 'استكشف واطلع على اللوائح والضوابط التنظيمية'
                : 'Explore and browse regulatory frameworks and controls'
              }
            </p>
          </div>
        </div>

        {/* Regulation Frameworks Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {regulationFrameworks.map((framework, index) => {
            const Icon = framework.icon;
            return (
              <Card key={index} className="glass-card hover-lift">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 bg-${framework.color}-100 rounded-lg flex items-center justify-center`}>
                      <Icon className={`h-6 w-6 text-${framework.color}-600`} />
                    </div>
                    <Badge variant={framework.status === 'active' ? 'default' : 'secondary'}>
                      {framework.status === 'active' 
                        ? (language === 'ar' ? 'نشط' : 'Active')
                        : (language === 'ar' ? 'التخطيط' : 'Planning')
                      }
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">
                    {language === 'ar' ? framework.nameAr : framework.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 text-sm mb-4">
                    {language === 'ar' ? framework.descriptionAr : framework.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">
                      {language === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {framework.totalControls}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search and Controls */}
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle className="text-xl">
                {language === 'ar' ? 'الضوابط الأساسية للأمن السيبراني' : 'Essential Cybersecurity Controls (ECC)'}
              </CardTitle>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={language === 'ar' ? 'البحث في الضوابط...' : 'Search controls...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              // Loading skeletons
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="space-y-3">
                      {[1, 2].map((j) => (
                        <div key={j} className="border border-slate-200 rounded-lg p-4">
                          <Skeleton className="h-5 w-32 mb-2" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : Object.keys(groupedControls).length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">
                  {language === 'ar' ? 'لم يتم العثور على ضوابط' : 'No controls found'}
                </h3>
                <p className="text-slate-500">
                  {language === 'ar' 
                    ? 'جرب البحث بمصطلحات مختلفة أو امسح مرشح البحث'
                    : 'Try searching with different terms or clear the search filter'
                  }
                </p>
              </div>
            ) : (
              Object.entries(groupedControls).map(([domain, domainControls]: [string, any]) => (
                <div key={domain} className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-slate-800">{domain}</h3>
                    <Badge variant="outline">
                      {(domainControls as any[]).length} {language === 'ar' ? 'ضابط' : 'controls'}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {(domainControls as any[]).map((control: any) => (
                      <div
                        key={control.id}
                        className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge variant="secondary" className="font-mono text-xs">
                                {control.code}
                              </Badge>
                              <span className="text-sm text-slate-500">
                                {language === 'ar' ? control.subdomainAr : control.subdomainEn}
                              </span>
                            </div>
                            <h4 className="font-medium text-slate-800 mb-2">
                              {language === 'ar' ? control.controlAr : control.controlEn}
                            </h4>
                            
                            {control.requirementEn && (
                              <div className="mt-3">
                                <h5 className="text-sm font-medium text-slate-700 mb-1">
                                  {language === 'ar' ? 'المتطلب:' : 'Requirement:'}
                                </h5>
                                <p className="text-sm text-slate-600">
                                  {language === 'ar' ? control.requirementAr : control.requirementEn}
                                </p>
                              </div>
                            )}
                            
                            {control.evidenceEn && (
                              <div className="mt-3">
                                <h5 className="text-sm font-medium text-slate-700 mb-1">
                                  {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                                </h5>
                                <p className="text-sm text-slate-600">
                                  {language === 'ar' ? control.evidenceAr : control.evidenceEn}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Separator />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
