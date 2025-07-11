import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Search, BookOpen, Shield, Database, Plus, Settings, FileText, Building } from 'lucide-react';

// Custom regulation schema
const customRegulationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameAr: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  descriptionAr: z.string().optional(),
  category: z.enum(['internal', 'external', 'industry', 'custom']),
  framework: z.string().optional(),
  version: z.string().default('1.0'),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
});

type CustomRegulationFormData = z.infer<typeof customRegulationSchema>;

export default function Regulations() {
  const { t, language } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: customRegulations, isLoading: isLoadingCustom } = useQuery({
    queryKey: ['/api/custom-regulations'],
  });

  const form = useForm<CustomRegulationFormData>({
    resolver: zodResolver(customRegulationSchema),
    defaultValues: {
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      category: 'internal',
      framework: '',
      version: '1.0',
      status: 'draft',
    },
  });

  const createRegulationMutation = useMutation({
    mutationFn: async (data: CustomRegulationFormData) => {
      await apiRequest('/api/custom-regulations', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/custom-regulations'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: language === 'ar' ? 'تم إنشاء التنظيم' : 'Regulation Created',
        description: language === 'ar' ? 'تم إنشاء التنظيم المخصص بنجاح' : 'Custom regulation created successfully',
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إنشاء التنظيم' : 'Failed to create regulation',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CustomRegulationFormData) => {
    createRegulationMutation.mutate(data);
  };

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
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {language === 'ar' ? 'إنشاء تنظيم مخصص' : 'Create Custom Regulation'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إنشاء تنظيم مخصص جديد' : 'Create New Custom Regulation'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الاسم (انجليزي)' : 'Name (English)'}</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., SOX Compliance" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="nameAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</FormLabel>
                          <FormControl>
                            <Input placeholder="مثال: ضوابط ساربينز أوكسلي" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الفئة' : 'Category'}</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="internal">{language === 'ar' ? 'داخلي' : 'Internal'}</SelectItem>
                              <SelectItem value="external">{language === 'ar' ? 'خارجي' : 'External'}</SelectItem>
                              <SelectItem value="industry">{language === 'ar' ? 'صناعي' : 'Industry'}</SelectItem>
                              <SelectItem value="custom">{language === 'ar' ? 'مخصص' : 'Custom'}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="framework"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الإطار المرجعي' : 'Framework'}</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., ISO 27001, SOX, COBIT" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الوصف (انجليزي)' : 'Description (English)'}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the purpose and scope of this regulation..."
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="descriptionAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="اشرح الغرض والنطاق من هذا التنظيم..."
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button type="submit" disabled={createRegulationMutation.isPending}>
                      {createRegulationMutation.isPending 
                        ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                        : (language === 'ar' ? 'إنشاء' : 'Create')
                      }
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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

        {/* Custom Regulations Section */}
        {customRegulations && customRegulations.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {language === 'ar' ? 'التنظيمات المخصصة' : 'Custom Regulations'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customRegulations.map((regulation: any) => (
                  <Card key={regulation.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {regulation.category}
                        </Badge>
                        <Badge variant={regulation.status === 'active' ? 'default' : 'secondary'}>
                          {regulation.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">
                        {language === 'ar' && regulation.nameAr ? regulation.nameAr : regulation.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {language === 'ar' && regulation.descriptionAr 
                          ? regulation.descriptionAr 
                          : regulation.description
                        }
                      </p>
                      {regulation.framework && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <FileText className="h-3 w-3" />
                          {regulation.framework}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
