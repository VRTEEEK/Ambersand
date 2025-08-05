import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TaskSearchInput } from '@/components/ui/TaskSearchInput';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { BookOpen, Shield, Database, Plus, Settings, FileText, Building, CheckSquare, Square, AlertTriangle } from 'lucide-react';

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

// Project creation schema
const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on-hold']).default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  ownerId: z.string().min(1, 'Project owner is required'),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
});

type ProjectFormData = z.infer<typeof projectSchema>;

export default function Regulations() {
  const { t, language } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedControlIds, setSelectedControlIds] = useState<number[]>([]);
  const [customControlEntries, setCustomControlEntries] = useState<Array<{
    id: string;
    mainDomain: string;
    mainDomainAr: string;
    subDomain: string;
    subDomainAr: string;
    control: string;
    controlAr: string;
    subControl: string;
    subControlAr: string;
    description: string;
    descriptionAr: string;
    evidenceRequired: boolean;
    evidenceNote: string;
    evidenceNoteAr: string;
    tags: string[];
  }>>([]);
  const [editingControlId, setEditingControlId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Only fetch ECC controls when ECC framework is selected
  const { data: controls, isLoading } = useQuery({
    queryKey: ['/api/ecc-controls', { search: searchTerm }],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      if (params?.search && typeof params.search === 'string') {
        searchParams.append('search', params.search);
      }
      const response = await fetch(`${url}?${searchParams}`);
      if (!response.ok) throw new Error('Failed to fetch controls');
      return response.json();
    },
    enabled: selectedFramework === 'ecc', // Only fetch when ECC is selected
  });

  const { data: customRegulations, isLoading: isLoadingCustom } = useQuery({
    queryKey: ['/api/custom-regulations'],
  });

  // Fetch users for project owner dropdown
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
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

  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      status: 'planning',
      priority: 'medium',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      ownerId: '',
    },
  });

  // Control entry form
  const controlForm = useForm({
    defaultValues: {
      mainDomain: '',
      mainDomainAr: '',
      subDomain: '',
      subDomainAr: '',
      control: '',
      controlAr: '',
      subControl: '',
      subControlAr: '',
      description: '',
      descriptionAr: '',
      evidenceRequired: false,
      evidenceNote: '',
      evidenceNoteAr: '',
      tags: [] as string[],
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

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const projectData = {
        ...data,
        controlIds: selectedControlIds,
        regulationType: 'ecc', // Since we're creating from ECC regulations page
      };
      return await apiRequest('/api/projects', 'POST', projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsProjectDialogOpen(false);
      setSelectedControlIds([]);
      projectForm.reset();
      toast({
        title: language === 'ar' ? 'تم إنشاء المشروع' : 'Project Created',
        description: language === 'ar' ? 'تم إنشاء مشروع الامتثال بنجاح' : 'Compliance project created successfully',
      });
    },
    onError: (error) => {
      console.error('Project creation error:', error);
      
      // Check if it's an authentication error
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        toast({
          title: language === 'ar' ? 'غير مصرح' : 'Unauthorized',
          description: language === 'ar' ? 'تم تسجيل خروجك. جاري تسجيل الدخول مرة أخرى...' : 'You are logged out. Logging in again...',
          variant: 'destructive',
        });
        setTimeout(() => {
          window.location.href = '/api/login';
        }, 1500);
        return;
      }
      
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' 
          ? `فشل في إنشاء المشروع: ${error.message || 'خطأ غير معروف'}`
          : `Failed to create project: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  // Control entry handlers
  const addControlEntry = (data: any) => {
    // Check for duplicate controls
    const isDuplicate = customControlEntries.some(entry => 
      entry.mainDomain.toLowerCase().trim() === data.mainDomain.toLowerCase().trim() &&
      entry.subDomain.toLowerCase().trim() === data.subDomain.toLowerCase().trim() &&
      entry.control.toLowerCase().trim() === data.control.toLowerCase().trim()
    );

    if (isDuplicate) {
      toast({
        title: language === 'ar' ? 'ضابط مكرر' : 'Duplicate Control',
        description: language === 'ar' 
          ? 'هذا الضابط موجود بالفعل. يرجى إدخال ضابط مختلف أو تعديل الضابط الموجود.'
          : 'This control already exists. Please enter a different control or edit the existing one.',
        variant: 'destructive',
      });
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      ...data,
      tags: typeof data.tags === 'string' ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : data.tags || [],
    };
    setCustomControlEntries(prev => [...prev, newEntry]);
    controlForm.reset();
    
    // Show success message
    toast({
      title: language === 'ar' ? 'تم إضافة الضابط' : 'Control Added',
      description: language === 'ar' ? 'تم إضافة الضابط بنجاح' : 'Control added successfully',
    });
  };

  const editControlEntry = (id: string) => {
    const entry = customControlEntries.find(e => e.id === id);
    if (entry) {
      controlForm.reset({
        ...entry,
        tags: entry.tags,
      });
      setEditingControlId(id);
    }
  };

  const updateControlEntry = (data: any) => {
    if (!editingControlId) return;
    
    // Check for duplicate controls (excluding the current entry being edited)
    const isDuplicate = customControlEntries.some(entry => 
      entry.id !== editingControlId &&
      entry.mainDomain.toLowerCase().trim() === data.mainDomain.toLowerCase().trim() &&
      entry.subDomain.toLowerCase().trim() === data.subDomain.toLowerCase().trim() &&
      entry.control.toLowerCase().trim() === data.control.toLowerCase().trim()
    );

    if (isDuplicate) {
      toast({
        title: language === 'ar' ? 'ضابط مكرر' : 'Duplicate Control',
        description: language === 'ar' 
          ? 'هذا الضابط موجود بالفعل. يرجى إدخال ضابط مختلف.'
          : 'This control already exists. Please enter a different control.',
        variant: 'destructive',
      });
      return;
    }
    
    setCustomControlEntries(prev => prev.map(entry => 
      entry.id === editingControlId 
        ? { 
          ...entry, 
          ...data,
          tags: typeof data.tags === 'string' ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : data.tags || [],
        }
        : entry
    ));
    controlForm.reset();
    setEditingControlId(null);
    
    // Show success message
    toast({
      title: language === 'ar' ? 'تم تحديث الضابط' : 'Control Updated',
      description: language === 'ar' ? 'تم تحديث الضابط بنجاح' : 'Control updated successfully',
    });
  };

  const deleteControlEntry = (id: string) => {
    setCustomControlEntries(prev => prev.filter(entry => entry.id !== id));
    
    // Show success message
    toast({
      title: language === 'ar' ? 'تم حذف الضابط' : 'Control Deleted',
      description: language === 'ar' ? 'تم حذف الضابط بنجاح' : 'Control deleted successfully',
    });
  };

  // Helper function to check for potential duplicates while typing
  const checkPotentialDuplicate = (mainDomain: string, subDomain: string, control: string) => {
    if (!mainDomain || !subDomain || !control) return false;
    
    return customControlEntries.some(entry => 
      entry.id !== editingControlId &&
      entry.mainDomain.toLowerCase().includes(mainDomain.toLowerCase()) &&
      entry.subDomain.toLowerCase().includes(subDomain.toLowerCase()) &&
      entry.control.toLowerCase().includes(control.toLowerCase())
    );
  };

  const onSubmit = async (data: CustomRegulationFormData) => {
    if (customControlEntries.length === 0) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى إضافة ضابط واحد على الأقل' : 'Please add at least one control',
        variant: 'destructive',
      });
      return;
    }

    // Include the control entries in the regulation data
    const regulationWithControls = {
      ...data,
      controls: customControlEntries,
    };
    
    createRegulationMutation.mutate(regulationWithControls);
  };

  const onProjectSubmit = (data: ProjectFormData) => {
    // Additional client-side validation for better UX
    if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
      toast({
        title: language === 'ar' ? 'خطأ في التواريخ' : 'Date Error',
        description: language === 'ar' ? 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }

    if (selectedControlIds.length === 0) {
      toast({
        title: language === 'ar' ? 'تحديد الضوابط مطلوب' : 'Control Selection Required',
        description: language === 'ar' ? 'يرجى تحديد ضابط واحد على الأقل للمشروع' : 'Please select at least one control for the project',
        variant: 'destructive',
      });
      return;
    }

    createProjectMutation.mutate(data);
  };

  // Control selection functions
  const toggleControl = (controlId: number) => {
    setSelectedControlIds(prev => 
      prev.includes(controlId) 
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const toggleDomainSelection = (domain: string) => {
    const domainControls = controls?.filter((control: any) => control.domainEn === domain) || [];
    const domainControlIds = domainControls.map((control: any) => control.id);
    
    const allSelected = domainControlIds.every((id: number) => selectedControlIds.includes(id));
    
    if (allSelected) {
      // Deselect all domain controls
      setSelectedControlIds(prev => prev.filter(id => !domainControlIds.includes(id)));
    } else {
      // Select all domain controls
      setSelectedControlIds(prev => {
        const newIds = [...prev];
        domainControlIds.forEach((id: number) => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  const isDomainSelected = (domain: string) => {
    const domainControls = controls?.filter((control: any) => control.domainEn === domain) || [];
    const domainControlIds = domainControls.map((control: any) => control.id);
    return domainControlIds.length > 0 && domainControlIds.every((id: number) => selectedControlIds.includes(id));
  };

  const isDomainPartiallySelected = (domain: string) => {
    const domainControls = controls?.filter((control: any) => control.domainEn === domain) || [];
    const domainControlIds = domainControls.map((control: any) => control.id);
    return domainControlIds.some((id: number) => selectedControlIds.includes(id)) && !isDomainSelected(domain);
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
      id: 'ecc',
      name: 'ECC (Essential Cybersecurity Controls)',
      nameAr: 'الضوابط الأساسية للأمن السيبراني',
      description: 'Saudi cybersecurity regulatory framework for critical infrastructure protection',
      descriptionAr: 'الإطار التنظيمي السعودي للأمن السيبراني لحماية البنى التحتية الحيوية',
      icon: Shield,
      color: 'teal',
      totalControls: 201,
      status: 'active',
    },
    {
      id: 'pdpl',
      name: 'PDPL (Personal Data Protection Law)',
      nameAr: 'نظام حماية البيانات الشخصية',
      description: 'Saudi personal data protection and privacy regulations',
      descriptionAr: 'لوائح حماية البيانات الشخصية والخصوصية السعودية',
      icon: Database,
      color: 'orange',
      totalControls: null,
      status: 'planning',
    },
    {
      id: 'ndmo',
      name: 'NDMO (National Data Management Office)',
      nameAr: 'مكتب إدارة البيانات الوطنية',
      description: 'National data governance and management requirements',
      descriptionAr: 'متطلبات حوكمة وإدارة البيانات الوطنية',
      icon: BookOpen,
      color: 'blue',
      totalControls: null,
      status: 'planning',
    },
  ];

  // Get unique main categories from ECC controls
  const getMainCategories = () => {
    if (!controls) return [];
    const categoryMap = new Map();
    controls.forEach((control: any) => {
      const domainEn = control.domainEn;
      const domainAr = control.domainAr;
      if (domainEn) {
        categoryMap.set(domainEn, {
          en: domainEn,
          ar: domainAr || domainEn
        });
      }
    });
    return Array.from(categoryMap.values());
  };

  // Get controls filtered by selected category
  const getFilteredControls = () => {
    if (!controls || !selectedCategory) return [];
    return controls.filter((control: any) => {
      const domainEn = control.domainEn;
      return domainEn === selectedCategory;
    });
  };

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
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إنشاء تنظيم مخصص جديد' : 'Create New Custom Regulation'}
                </DialogTitle>
                <DialogDescription>
                  {language === 'ar' 
                    ? 'إنشاء تنظيم مخصص مع ضوابط متعددة وهيكل مفصل'
                    : 'Create a custom regulation with multiple controls and detailed structure'
                  }
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-8">
                {/* Regulation Basic Info */}
                <Form {...form}>
                  <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Settings className="h-5 w-5 text-teal-600" />
                      {language === 'ar' ? 'معلومات التنظيم الأساسية' : 'Regulation Basic Information'}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الاسم (انجليزي)' : 'Name (English)'} *</FormLabel>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الوصف (انجليزي)' : 'Description (English)'} *</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Describe the purpose and scope of this regulation..."
                                className="min-h-[80px]"
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
                                className="min-h-[80px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </Form>

                {/* Controls Section */}
                <div className="bg-gradient-to-r from-teal-50 to-white dark:from-teal-900/20 dark:to-gray-900 rounded-lg p-6 border border-teal-200 dark:border-teal-700">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-teal-600" />
                      {language === 'ar' ? 'الضوابط المخصصة' : 'Custom Controls'}
                      {customControlEntries.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {customControlEntries.length}
                        </Badge>
                      )}
                    </h3>
                  </div>

                  {/* Control Entry Form */}
                  <Form {...controlForm}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-6">
                      <h4 className="font-medium mb-4 flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        {editingControlId 
                          ? (language === 'ar' ? 'تعديل الضابط' : 'Edit Control')
                          : (language === 'ar' ? 'إضافة ضابط جديد' : 'Add New Control')
                        }
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="mainDomain"
                          render={({ field }) => {
                            const mainDomain = controlForm.watch('mainDomain');
                            const subDomain = controlForm.watch('subDomain');
                            const control = controlForm.watch('control');
                            const hasPotentialDuplicate = checkPotentialDuplicate(mainDomain, subDomain, control);
                            
                            return (
                              <FormItem>
                                <FormLabel>{language === 'ar' ? 'المجال الرئيسي (انجليزي)' : 'Main Domain (English)'} *</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., Access Control" 
                                    {...field}
                                    className={hasPotentialDuplicate ? 'border-amber-300 bg-amber-50 focus:border-amber-400' : ''}
                                  />
                                </FormControl>
                                <FormMessage />
                                {hasPotentialDuplicate && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {language === 'ar' ? 'قد يكون هناك ضابط مشابه موجود' : 'Similar control may already exist'}
                                  </p>
                                )}
                              </FormItem>
                            );
                          }}
                        />
                        <FormField
                          control={controlForm.control}
                          name="mainDomainAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'المجال الرئيسي (عربي)' : 'Main Domain (Arabic)'}</FormLabel>
                              <FormControl>
                                <Input placeholder="مثال: التحكم في الوصول" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="subDomain"
                          render={({ field }) => {
                            const mainDomain = controlForm.watch('mainDomain');
                            const subDomain = controlForm.watch('subDomain');
                            const control = controlForm.watch('control');
                            const hasPotentialDuplicate = checkPotentialDuplicate(mainDomain, subDomain, control);
                            
                            return (
                              <FormItem>
                                <FormLabel>{language === 'ar' ? 'المجال الفرعي (انجليزي)' : 'Sub Domain (English)'} *</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., User Authentication" 
                                    {...field}
                                    className={hasPotentialDuplicate ? 'border-amber-300 bg-amber-50 focus:border-amber-400' : ''}
                                  />
                                </FormControl>
                                <FormMessage />
                                {hasPotentialDuplicate && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {language === 'ar' ? 'قد يكون هناك ضابط مشابه موجود' : 'Similar control may already exist'}
                                  </p>
                                )}
                              </FormItem>
                            );
                          }}
                        />
                        <FormField
                          control={controlForm.control}
                          name="subDomainAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'المجال الفرعي (عربي)' : 'Sub Domain (Arabic)'}</FormLabel>
                              <FormControl>
                                <Input placeholder="مثال: مصادقة المستخدم" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="control"
                          render={({ field }) => {
                            const mainDomain = controlForm.watch('mainDomain');
                            const subDomain = controlForm.watch('subDomain');
                            const control = controlForm.watch('control');
                            const hasPotentialDuplicate = checkPotentialDuplicate(mainDomain, subDomain, control);
                            
                            return (
                              <FormItem>
                                <FormLabel>{language === 'ar' ? 'الضابط (انجليزي)' : 'Control (English)'} *</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Describe the main control requirement..."
                                    className={`min-h-[60px] ${hasPotentialDuplicate ? 'border-amber-300 bg-amber-50 focus:border-amber-400' : ''}`}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                                {hasPotentialDuplicate && (
                                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {language === 'ar' ? 'قد يكون هناك ضابط مشابه موجود' : 'Similar control may already exist'}
                                  </p>
                                )}
                              </FormItem>
                            );
                          }}
                        />
                        <FormField
                          control={controlForm.control}
                          name="controlAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'الضابط (عربي)' : 'Control (Arabic)'}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="اشرح متطلب الضابط الرئيسي..."
                                  className="min-h-[60px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="subControl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'الضابط الفرعي (انجليزي) - اختياري' : 'Sub Control (English) - Optional'}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Additional sub-control details (optional)..."
                                  className="min-h-[50px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={controlForm.control}
                          name="subControlAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'الضابط الفرعي (عربي) - اختياري' : 'Sub Control (Arabic) - Optional'}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="تفاصيل الضابط الفرعي الإضافية (اختياري)..."
                                  className="min-h-[50px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'الوصف التفصيلي (انجليزي)' : 'Detailed Description (English)'} *</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Provide detailed description of implementation requirements..."
                                  className="min-h-[80px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={controlForm.control}
                          name="descriptionAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'الوصف التفصيلي (عربي)' : 'Detailed Description (Arabic)'}</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="قدم وصفاً مفصلاً لمتطلبات التنفيذ..."
                                  className="min-h-[80px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <FormField
                          control={controlForm.control}
                          name="evidenceRequired"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {language === 'ar' ? 'دليل مطلوب' : 'Evidence Required'}
                                </FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={controlForm.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === 'ar' ? 'العلامات (مفصولة بفواصل)' : 'Tags (comma-separated)'}</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="security, compliance, critical"
                                  value={Array.isArray(field.value) ? field.value.join(', ') : field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {controlForm.watch('evidenceRequired') && (
                        <div className="grid grid-cols-1 gap-4 mb-4">
                          <FormField
                            control={controlForm.control}
                            name="evidenceNote"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{language === 'ar' ? 'ملاحظة الدليل (انجليزي)' : 'Evidence Note (English)'}</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Specify what evidence is required..."
                                    className="min-h-[60px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={controlForm.control}
                            name="evidenceNoteAr"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{language === 'ar' ? 'ملاحظة الدليل (عربي)' : 'Evidence Note (Arabic)'}</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="حدد ما هو الدليل المطلوب..."
                                    className="min-h-[60px]"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        {editingControlId && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              controlForm.reset();
                              setEditingControlId(null);
                            }}
                          >
                            {language === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={controlForm.handleSubmit(editingControlId ? updateControlEntry : addControlEntry)}
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          {editingControlId 
                            ? (language === 'ar' ? 'تحديث الضابط' : 'Update Control')
                            : (language === 'ar' ? 'إضافة الضابط' : 'Add Control')
                          }
                        </Button>
                      </div>
                    </div>
                  </Form>

                  {/* Added Controls List */}
                  {customControlEntries.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-800 dark:text-gray-200">
                        {language === 'ar' ? 'الضوابط المضافة' : 'Added Controls'}
                      </h4>
                      {customControlEntries.map((entry, index) => (
                        <Card key={entry.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {index + 1}
                                  </Badge>
                                  <h5 className="font-medium text-sm">
                                    {language === 'ar' && entry.mainDomainAr ? entry.mainDomainAr : entry.mainDomain}
                                    {' → '}
                                    {language === 'ar' && entry.subDomainAr ? entry.subDomainAr : entry.subDomain}
                                  </h5>
                                  {entry.evidenceRequired && (
                                    <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                                      {language === 'ar' ? 'دليل مطلوب' : 'Evidence Required'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                  {language === 'ar' && entry.controlAr ? entry.controlAr : entry.control}
                                </p>
                                {entry.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {entry.tags.map((tag, tagIndex) => (
                                      <Badge key={tagIndex} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editControlEntry(entry.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Settings className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteControlEntry(entry.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  ×
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      setCustomControlEntries([]);
                      setEditingControlId(null);
                      form.reset();
                      controlForm.reset();
                    }}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={createRegulationMutation.isPending || customControlEntries.length === 0}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {createRegulationMutation.isPending 
                      ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                      : (language === 'ar' ? 'إنشاء التنظيم' : 'Create Regulation')
                    }
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Regulation Frameworks Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {regulationFrameworks.map((framework, index) => {
            const Icon = framework.icon;
            const isSelected = selectedFramework === framework.id;
            return (
              <Card 
                key={index} 
                className={`group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-[1.02] ${
                  isSelected 
                    ? 'ring-2 ring-[#2699A6] shadow-2xl bg-gradient-to-br from-white via-[#f8fdfc] to-[#f1f9f8] dark:from-slate-800 dark:via-slate-800 dark:to-slate-700' 
                    : 'bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 hover:from-slate-50 hover:via-white hover:to-slate-50'
                }`}
                onClick={() => {
                  setSelectedFramework(framework.id);
                  setSelectedCategory(null);
                }}
              >
                {/* Animated background overlay */}
                <div className={`absolute inset-0 bg-gradient-to-r transition-opacity duration-300 ${
                  isSelected 
                    ? 'from-[#2699A6]/5 via-transparent to-[#2699A6]/5 opacity-100' 
                    : 'from-[#2699A6]/0 via-transparent to-[#2699A6]/0 opacity-0 group-hover:opacity-100'
                }`}></div>
                
                {/* Decorative corner element */}
                <div className={`absolute top-0 right-0 w-20 h-20 transform translate-x-6 -translate-y-6 transition-all duration-300 ${
                  isSelected ? 'bg-[#2699A6]/10' : 'bg-slate-200/50 group-hover:bg-[#2699A6]/5'
                } rounded-full`}></div>
                
                <CardHeader className="relative pb-4 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 ${
                      isSelected 
                        ? 'bg-gradient-to-br from-[#2699A6] to-[#1e7a85] shadow-[#2699A6]/25' 
                        : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 group-hover:from-[#2699A6]/10 group-hover:to-[#2699A6]/20'
                    }`}>
                      <Icon className={`h-7 w-7 transition-colors duration-300 ${
                        isSelected 
                          ? 'text-white' 
                          : 'text-slate-600 dark:text-slate-400 group-hover:text-[#2699A6]'
                      }`} />
                    </div>
                    <Badge 
                      variant="outline"
                      className={`border-0 font-medium px-3 py-1.5 text-xs transition-all duration-300 ${
                        framework.status === 'active'
                          ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 shadow-sm'
                          : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 shadow-sm'
                      }`}
                    >
                      {framework.status === 'active' 
                        ? (language === 'ar' ? 'نشط' : 'Active')
                        : (language === 'ar' ? 'قريباً' : 'Coming Soon')
                      }
                    </Badge>
                  </div>
                  <CardTitle className={`text-xl font-bold leading-tight transition-colors duration-300 ${
                    isSelected 
                      ? 'text-slate-900 dark:text-white' 
                      : 'text-slate-800 dark:text-slate-100 group-hover:text-slate-900 dark:group-hover:text-white'
                  }`}>
                    {language === 'ar' ? framework.nameAr : framework.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 line-clamp-3 leading-relaxed">
                    {language === 'ar' ? framework.descriptionAr : framework.description}
                  </p>
                  {framework.totalControls && (
                    <div className={`relative overflow-hidden rounded-xl p-4 transition-all duration-300 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-[#2699A6]/10 via-[#2699A6]/5 to-transparent border border-[#2699A6]/20' 
                        : 'bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-700/50 dark:via-slate-800/50 dark:to-slate-700/50 border border-slate-200/50 dark:border-slate-600/50'
                    }`}>
                      {/* Subtle animated background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent transform -skew-x-12 transition-transform duration-1000 group-hover:translate-x-full opacity-0 group-hover:opacity-100"></div>
                      
                      <div className="relative flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {language === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-3xl font-bold transition-colors duration-300 ${
                              isSelected 
                                ? 'text-[#2699A6]' 
                                : 'text-slate-900 dark:text-white group-hover:text-[#2699A6]'
                            }`}>
                              {framework.totalControls}
                            </span>
                            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              isSelected 
                                ? 'bg-[#2699A6] shadow-md shadow-[#2699A6]/50' 
                                : 'bg-slate-400 group-hover:bg-[#2699A6]'
                            }`}></div>
                          </div>
                        </div>
                        
                        {/* Progress indicator */}
                        <div className="flex flex-col items-end">
                          <div className={`w-12 h-12 rounded-full border-4 transition-all duration-300 flex items-center justify-center ${
                            isSelected 
                              ? 'border-[#2699A6]/30 bg-[#2699A6]/10' 
                              : 'border-slate-200 dark:border-slate-600 group-hover:border-[#2699A6]/30'
                          }`}>
                            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
                              isSelected 
                                ? 'bg-[#2699A6]' 
                                : 'bg-slate-300 group-hover:bg-[#2699A6]'
                            }`}></div>
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

        {/* Custom Regulations Section */}
        {Array.isArray(customRegulations) && customRegulations.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {language === 'ar' ? 'التنظيمات المخصصة' : 'Custom Regulations'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.isArray(customRegulations) && customRegulations.map((regulation: any) => (
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

        {/* ECC Framework Details */}
        {selectedFramework === 'ecc' && (
          <Card className="glass-card border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
            <CardHeader className="bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-t-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="flex items-center gap-3 text-xl font-bold">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Shield className="h-6 w-6" />
                  </div>
                  {language === 'ar' ? 'الضوابط الأساسية للأمن السيبراني' : 'Essential Cybersecurity Controls'}
                </CardTitle>
                <div className="w-full sm:w-96">
                  <TaskSearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={language === 'ar' ? 'البحث في الضوابط...' : 'Search controls...'}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-800/50 dark:to-gray-900">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !selectedCategory ? (
                // Show main categories first
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-12 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full"></div>
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                      {language === 'ar' ? 'المجالات الرئيسية' : 'Main Domains'}
                    </h3>
                    <div className="h-1 flex-1 bg-gradient-to-r from-teal-600 to-transparent rounded-full"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {getMainCategories().map((category: any, index) => {
                      const domainControlsCount = controls?.filter((c: any) => c.domainEn === category.en).length || 0;
                      const selectedCount = controls?.filter((c: any) => c.domainEn === category.en && selectedControlIds.includes(c.id)).length || 0;
                      const isSelected = isDomainSelected(category.en);
                      const isPartiallySelected = isDomainPartiallySelected(category.en);
                      
                      return (
                        <Card 
                          key={index}
                          className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 hover:scale-105"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          <CardHeader className="pb-4 relative z-10">
                            <CardTitle className="text-lg flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="relative">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleDomainSelection(category.en)}
                                    className="flex-shrink-0 scale-110 cursor-pointer hover:scale-125 transition-transform duration-200"
                                  />
                                  {isSelected && (
                                    <div className="absolute -inset-1 bg-teal-500/20 rounded-full animate-pulse pointer-events-none"></div>
                                  )}
                                  {isPartiallySelected && !isSelected && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-2 h-2 bg-blue-500 rounded-sm"></div>
                                    </div>
                                  )}
                                </div>
                                <span
                                  className="cursor-pointer font-semibold text-gray-800 dark:text-gray-200 group-hover:text-teal-600 transition-colors"
                                  onClick={() => setSelectedCategory(category.en)}
                                >
                                  {language === 'ar' ? category.ar : category.en}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {selectedCount > 0 && (
                                  <Badge variant="default" className="bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md animate-pulse">
                                    {selectedCount}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="border-gray-300 text-gray-600 bg-white/80">
                                  {domainControlsCount}
                                </Badge>
                              </div>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="relative z-10">
                            <div className="h-1 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full mb-4"></div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer group-hover:text-teal-600 transition-colors">
                              {language === 'ar' ? 'انقر لعرض الضوابط في هذا المجال' : 'Click to view controls under this domain'}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Show filtered controls for selected category
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCategory(null)}
                          className="flex items-center gap-2 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-all"
                        >
                          ← {language === 'ar' ? 'العودة للمجالات' : 'Back to Domains'}
                        </Button>
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-2 bg-teal-500 rounded-full"></div>
                          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                            {getMainCategories().find(cat => cat.en === selectedCategory)?.[language === 'ar' ? 'ar' : 'en'] || selectedCategory}
                          </h3>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const categoryControls = getFilteredControls();
                          const categoryControlIds = categoryControls.map((control: any) => control.id);
                          const allSelected = categoryControlIds.every((id: number) => selectedControlIds.includes(id));
                          
                          if (allSelected) {
                            // Deselect all controls in this category
                            setSelectedControlIds(prev => prev.filter(id => !categoryControlIds.includes(id)));
                          } else {
                            // Select all controls in this category
                            setSelectedControlIds(prev => {
                              const newIds = [...prev];
                              categoryControlIds.forEach((id: number) => {
                                if (!newIds.includes(id)) {
                                  newIds.push(id);
                                }
                              });
                              return newIds;
                            });
                          }
                        }}
                        className={(() => {
                          const categoryControls = getFilteredControls();
                          const categoryControlIds = categoryControls.map((control: any) => control.id);
                          const allSelected = categoryControlIds.every((id: number) => selectedControlIds.includes(id));
                          return allSelected 
                            ? "flex items-center gap-2 bg-gradient-to-r from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 text-teal-700 border-teal-300 shadow-md"
                            : "flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 border-gray-300 shadow-md";
                        })()}
                      >
                        {(() => {
                          const categoryControls = getFilteredControls();
                          const categoryControlIds = categoryControls.map((control: any) => control.id);
                          const allSelected = categoryControlIds.every((id: number) => selectedControlIds.includes(id));
                          return allSelected 
                            ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                            : (language === 'ar' ? 'تحديد الكل' : 'Select All');
                        })()}
                        <Badge 
                          variant="secondary" 
                          className={(() => {
                            const categoryControls = getFilteredControls();
                            const categoryControlIds = categoryControls.map((control: any) => control.id);
                            const allSelected = categoryControlIds.every((id: number) => selectedControlIds.includes(id));
                            return allSelected 
                              ? "bg-white text-teal-700 border border-teal-200"
                              : "bg-white text-gray-600 border border-gray-200";
                          })()}
                        >
                          {getFilteredControls().length}
                        </Badge>
                      </Button>
                    </div>
                  </div>
                  <TooltipProvider>
                    <div className="space-y-3">
                      {getFilteredControls().map((control: any) => {
                        const isSelected = selectedControlIds.includes(control.id);
                      return (
                        <div
                          key={control.id}
                          className={`border rounded-lg p-4 transition-all duration-200 ${
                            isSelected 
                              ? 'border-teal-300 bg-teal-50 shadow-sm ring-1 ring-teal-200' 
                              : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedControlIds.includes(control.id)}
                              onCheckedChange={() => toggleControl(control.id)}
                              className="mt-1 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="inline-block">
                                      <Badge 
                                        className="text-xs text-[#f8f7fc] bg-[#18b5a7] font-mono px-2 py-1 rounded cursor-help"
                                      >
                                        {control.code}
                                      </Badge>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm p-3">
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm">
                                        {control.code} - {language === 'ar' && control.domainAr ? control.domainAr : control.domainEn}
                                      </div>
                                      <div className="text-xs text-gray-600 leading-relaxed">
                                        {language === 'ar' && control.subdomainAr ? control.subdomainAr : control.subdomainEn}
                                      </div>
                                      {(control.evidenceEn || control.evidenceAr) && (
                                        <div className="pt-1 border-t">
                                          <div className="text-xs font-medium text-blue-600">
                                            {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-1 max-h-20 overflow-y-auto">
                                            {language === 'ar' && control.evidenceAr ? control.evidenceAr : control.evidenceEn}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                                <h4 className="font-medium text-slate-900 truncate">
                                  {language === 'ar' && control.subdomainAr ? control.subdomainAr : control.subdomainEn}
                                </h4>
                              </div>
                              
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {language === 'ar' && control.controlAr 
                                  ? control.controlAr.length > 150 
                                    ? control.controlAr.substring(0, 150) + '...'
                                    : control.controlAr
                                  : control.controlEn
                                    ? control.controlEn.length > 150 
                                      ? control.controlEn.substring(0, 150) + '...'
                                      : control.controlEn
                                    : 'No description available'
                                }
                              </p>
                              
                              {(control.evidenceEn || control.evidenceAr) && (
                                <div className="text-sm">
                                  <span className="font-medium text-slate-700">
                                    {language === 'ar' ? 'الأدلة المطلوبة: ' : 'Evidence Required: '}
                                  </span>
                                  <span className="text-slate-600">
                                    {language === 'ar' && control.evidenceAr 
                                      ? control.evidenceAr.length > 100
                                        ? control.evidenceAr.substring(0, 100) + '...'
                                        : control.evidenceAr
                                      : control.evidenceEn
                                        ? control.evidenceEn.length > 100
                                          ? control.evidenceEn.substring(0, 100) + '...'
                                          : control.evidenceEn
                                        : (language === 'ar' ? 'غير محدد' : 'Not specified')
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </TooltipProvider>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Other Framework Details */}
        {selectedFramework && selectedFramework !== 'ecc' && (
          <Card className="glass-card border-0 shadow-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900">
            <CardHeader className="bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-3 text-xl font-bold">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  {selectedFramework === 'pdpl' && <Database className="h-6 w-6" />}
                  {selectedFramework === 'ndmo' && <BookOpen className="h-6 w-6" />}
                </div>
                {regulationFrameworks.find(f => f.id === selectedFramework)?.nameAr && language === 'ar'
                  ? regulationFrameworks.find(f => f.id === selectedFramework)?.nameAr
                  : regulationFrameworks.find(f => f.id === selectedFramework)?.name
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-12 bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-800/50 dark:to-gray-900">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700/30 dark:to-gray-800/30 mb-6">
                  {selectedFramework === 'pdpl' && <Database className="h-12 w-12 text-gray-600" />}
                  {selectedFramework === 'ndmo' && <BookOpen className="h-12 w-12 text-gray-600" />}
                </div>
                <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
                  {language === 'ar' 
                    ? 'تفاصيل هذا الإطار التنظيمي ستكون متاحة قريباً'
                    : 'Details for this regulatory framework will be available soon'
                  }
                </p>
                <div className="mt-6 h-1 w-32 mx-auto bg-gradient-to-r from-gray-400 to-gray-500 rounded-full"></div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floating Create Project Button - Shows when controls are selected */}
        {selectedControlIds.length > 0 && (
          <div className="fixed bottom-8 right-8 z-50">
            <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  {language === 'ar' ? 'إنشاء مشروع' : 'Create Project'}
                  <Badge variant="secondary" className="bg-white text-teal-600 ml-2">
                    {selectedControlIds.length}
                  </Badge>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {language === 'ar' ? 'إنشاء مشروع امتثال جديد' : 'Create New Compliance Project'}
                  </DialogTitle>
                  <DialogDescription>
                    {language === 'ar' 
                      ? `إنشاء مشروع امتثال جديد مع ${selectedControlIds.length} ضابط محدد`
                      : `Create a new compliance project with ${selectedControlIds.length} selected controls`
                    }
                  </DialogDescription>
                </DialogHeader>
                <Form {...projectForm}>
                  <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-6">
                    {/* Project Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={projectForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'اسم المشروع (انجليزي)' : 'Project Name (English)'}</FormLabel>
                            <FormControl>
                              <Input placeholder="ECC Compliance Implementation" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={projectForm.control}
                        name="nameAr"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'اسم المشروع (عربي)' : 'Project Name (Arabic)'}</FormLabel>
                            <FormControl>
                              <Input placeholder="تطبيق ضوابط الأمن السيبراني الأساسية" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={projectForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الحالة' : 'Status'}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="planning">{language === 'ar' ? 'تخطيط' : 'Planning'}</SelectItem>
                                <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                                <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
                                <SelectItem value="on-hold">{language === 'ar' ? 'معلق' : 'On Hold'}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={projectForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'الأولوية' : 'Priority'}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">{language === 'ar' ? 'منخفضة' : 'Low'}</SelectItem>
                                <SelectItem value="medium">{language === 'ar' ? 'متوسطة' : 'Medium'}</SelectItem>
                                <SelectItem value="high">{language === 'ar' ? 'عالية' : 'High'}</SelectItem>
                                <SelectItem value="urgent">{language === 'ar' ? 'عاجلة' : 'Urgent'}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={projectForm.control}
                        name="ownerId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'مالك المشروع' : 'Project Owner'} *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={language === 'ar' ? 'اختر المالك...' : 'Select owner...'} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Array.isArray(users) && users.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {user.firstName} {user.lastName}
                                      </span>
                                      <span className="text-sm text-gray-500">({user.email})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={projectForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={projectForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={projectForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الوصف (انجليزي)' : 'Description (English)'}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe the project goals and scope..."
                              className="min-h-[80px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={projectForm.control}
                      name="descriptionAr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="اشرح أهداف ونطاق المشروع..."
                              className="min-h-[80px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Selected Controls Summary */}
                    <div className="border-t pt-4">
                      <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-5 w-5 text-teal-600" />
                        {language === 'ar' ? 'الضوابط المحددة' : 'Selected Controls'}
                        <Badge variant="secondary">{selectedControlIds.length}</Badge>
                      </h4>
                      <div className="max-h-32 overflow-y-auto bg-slate-50 rounded-md p-3">
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-1">
                            {selectedControlIds.map(id => {
                              const control = controls?.find((c: any) => c.id === id);
                              return control ? (
                                <Tooltip key={id}>
                                  <TooltipTrigger asChild>
                                    <div className="inline-block">
                                      <Badge variant="outline" className="text-xs text-[#f8f7fc] bg-[#18b5a7] cursor-help">
                                        {control.code}
                                      </Badge>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm p-3">
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm">
                                        {control.code} - {language === 'ar' && control.subdomainAr ? control.subdomainAr : control.subdomainEn}
                                      </div>
                                      <div className="text-xs text-gray-600 leading-relaxed">
                                        {language === 'ar' && control.controlAr ? control.controlAr : control.controlEn}
                                      </div>
                                      {(control.evidenceEn || control.evidenceAr) && (
                                        <div className="pt-1 border-t">
                                          <div className="text-xs font-medium text-blue-600">
                                            {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            {language === 'ar' && control.evidenceAr ? control.evidenceAr : control.evidenceEn}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : null;
                            })}
                          </div>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsProjectDialogOpen(false);
                          projectForm.reset();
                        }}
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createProjectMutation.isPending}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        {createProjectMutation.isPending 
                          ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                          : (language === 'ar' ? 'إنشاء المشروع' : 'Create Project')
                        }
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
