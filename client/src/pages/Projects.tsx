import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import AppLayout from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { isUnauthorizedError } from '@/lib/authUtils';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskSearchInput } from '@/components/ui/TaskSearchInput';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Calendar, 
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
} from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['planning', 'active', 'completed', 'on-hold', 'overdue']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  regulationType: z.enum(['ecc', 'pdpl', 'ndmo']).optional(),
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

export default function Projects() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [regulationFilter, setRegulationFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['/api/projects'],
    retry: false,
  });

  // Fetch all tasks to calculate real progress
  const { data: allTasks } = useQuery({
    queryKey: ['/api/tasks'],
    retry: false,
  });

  // Fetch users for project owner display
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    retry: false,
  });

  // Calculate progress for each project and add owner information
  const projectsWithProgress = (projects && Array.isArray(projects)) ? projects.map((project: any) => {
    const projectTasks = (allTasks && Array.isArray(allTasks)) ? allTasks.filter((task: any) => task.projectId === project.id) : [];
    const completedTasks = projectTasks.filter((task: any) => task.status === 'completed').length;
    const totalTasks = projectTasks.length;
    const realProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Find project owner
    const owner = (users && Array.isArray(users)) ? users.find((user: any) => user.id === project.ownerId) : null;
    
    return {
      ...project,
      realProgress,
      taskCount: totalTasks,
      completedTaskCount: completedTasks,
      owner
    };
  }) : [];

  const form = useForm<ProjectFormData>({
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
      regulationType: 'ecc',
      ownerId: '',
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData & { id: number }) => {
      const { id, ...projectData } = data;
      return await apiRequest(`/api/projects/${id}`, 'PUT', projectData);
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure proper refresh
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setIsEditDialogOpen(false);
      setEditingProject(null);
      form.reset();
      toast({
        title: language === 'ar' ? 'تم تحديث المشروع' : 'Project Updated',
        description: language === 'ar' ? 'تم تحديث المشروع بنجاح' : 'Project updated successfully',
      });
    },
    onError: (error) => {
      console.error('Project update error:', error);
      
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
          ? `فشل في تحديث المشروع: ${error.message || 'خطأ غير معروف'}`
          : `Failed to update project: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/projects/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: language === 'ar' ? 'تم حذف المشروع' : 'Project Deleted',
        description: language === 'ar' ? 'تم حذف المشروع بنجاح' : 'Project deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Project delete error:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حذف المشروع' : 'Failed to delete project',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    // Additional client-side validation for better UX
    if (data.startDate && data.endDate && new Date(data.endDate) <= new Date(data.startDate)) {
      toast({
        title: language === 'ar' ? 'خطأ في التواريخ' : 'Date Error',
        description: language === 'ar' ? 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' : 'End date must be after start date',
        variant: 'destructive',
      });
      return;
    }

    if (editingProject) {
      updateProjectMutation.mutate({ ...data, id: editingProject.id });
    }
  };

  const handleEdit = useCallback((project: any) => {
    console.log('handleEdit called with project:', project);
    try {
      setEditingProject(project);
      form.reset({
        name: project.name || '',
        nameAr: project.nameAr || '',
        description: project.description || '',
        descriptionAr: project.descriptionAr || '',
        status: project.status || 'planning',
        priority: project.priority || 'medium',
        startDate: project.startDate || '',
        endDate: project.endDate || '',
        regulationType: project.regulationType || 'ecc',
        ownerId: project.ownerId || '',
      });
      setIsEditDialogOpen(true);
    } catch (error) {
      console.error('Error in handleEdit:', error);
    }
  }, [form]);

  const handleDelete = useCallback((project: any) => {
    console.log('handleDelete called with project:', project);
    if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المشروع؟' : 'Are you sure you want to delete this project?')) {
      deleteProjectMutation.mutate(project.id);
    }
  }, [language, deleteProjectMutation]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'completed': return 'secondary';
      case 'planning': return 'outline';
      case 'on-hold': return 'destructive';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    if (language === 'ar') {
      switch (status) {
        case 'active': return 'نشط';
        case 'completed': return 'مكتمل';
        case 'planning': return 'تخطيط';
        case 'on-hold': return 'معلق';
        case 'overdue': return 'متأخر';
        default: return status;
      }
    }
    return status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-slate-600';
    }
  };

  const filteredProjects = projectsWithProgress?.filter((project: any) => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesRegulation = regulationFilter === 'all' || project.regulationType === regulationFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesRegulation && matchesPriority;
  }) || [];

  if (error && isUnauthorizedError(error as Error)) {
    return null; // Will redirect to login
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {t('nav.projects')}
            </h1>
            <p className="text-slate-600 mt-1">
              {language === 'ar'
                ? 'إدارة وتتبع مشاريع الامتثال'
                : 'Manage and track compliance projects'
              }
            </p>
          </div>
        </div>

        {/* Edit Project Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تعديل المشروع' : 'Edit Project'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'تعديل تفاصيل المشروع' : 'Modify project details'}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name (English)</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>Project Name (Arabic)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (English)</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
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
                        <FormLabel>Description (Arabic)</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on-hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="regulationType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regulation Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ecc">ECC</SelectItem>
                            <SelectItem value="pdpl">PDPL</SelectItem>
                            <SelectItem value="ndmo">NDMO</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Project Owner Selection */}
                <FormField
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {language === 'ar' ? 'مالك المشروع' : 'Project Owner'}
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر مالك المشروع' : 'Select project owner'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(users && Array.isArray(users)) ? users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <UserAvatar user={user} size="sm" />
                                <span>{user.firstName} {user.lastName}</span>
                                <span className="text-xs text-slate-500">({user.email})</span>
                              </div>
                            </SelectItem>
                          )) : null}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditDialogOpen(false);
                      setEditingProject(null);
                      form.reset();
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateProjectMutation.isPending}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {updateProjectMutation.isPending ? 'Updating...' : t('common.update')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <TaskSearchInput
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder={language === 'ar' ? 'البحث في المشاريع...' : 'Search projects...'}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={language === 'ar' ? 'الحالة' : 'Status'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ar' ? 'جميع الحالات' : 'All Status'}</SelectItem>
                    <SelectItem value="planning">{language === 'ar' ? 'تخطيط' : 'Planning'}</SelectItem>
                    <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                    <SelectItem value="completed">{language === 'ar' ? 'مكتمل' : 'Completed'}</SelectItem>
                    <SelectItem value="on-hold">{language === 'ar' ? 'معلق' : 'On Hold'}</SelectItem>
                    <SelectItem value="overdue">{language === 'ar' ? 'متأخر' : 'Overdue'}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={regulationFilter} onValueChange={setRegulationFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={language === 'ar' ? 'النظام' : 'Regulation'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ar' ? 'جميع الأنظمة' : 'All Regulations'}</SelectItem>
                    <SelectItem value="ecc">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">ECC</Badge>
                        <span>{language === 'ar' ? 'الضوابط الأساسية' : 'Essential Controls'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pdpl">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">PDPL</Badge>
                        <span>{language === 'ar' ? 'حماية البيانات' : 'Data Protection'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ndmo">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">NDMO</Badge>
                        <span>{language === 'ar' ? 'إدارة البيانات' : 'Data Management'}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={language === 'ar' ? 'الأولوية' : 'Priority'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === 'ar' ? 'جميع الأولويات' : 'All Priorities'}</SelectItem>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{language === 'ar' ? 'منخفضة' : 'Low Priority'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>{language === 'ar' ? 'متوسطة' : 'Medium Priority'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span>{language === 'ar' ? 'عالية' : 'High Priority'}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{language === 'ar' ? 'عاجلة' : 'Urgent Priority'}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredProjects.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">
                {searchTerm || statusFilter !== 'all' || regulationFilter !== 'all' || priorityFilter !== 'all'
                  ? (language === 'ar' ? 'لم يتم العثور على مشاريع' : 'No projects found')
                  : (language === 'ar' ? 'لا توجد مشاريع' : 'No projects yet')
                }
              </h3>
              <p className="text-slate-500 mb-4">
                {searchTerm || statusFilter !== 'all' || regulationFilter !== 'all' || priorityFilter !== 'all'
                  ? (language === 'ar' ? 'جرب تغيير مرشحات البحث أو الحالة أو النظام أو الأولوية' : 'Try adjusting your search, status, regulation, or priority filters')
                  : (language === 'ar' ? 'يمكنك إنشاء مشروع من صفحة الأنظمة' : 'You can create projects from the Regulations page')
                }
              </p>
            </div>
          ) : (
            filteredProjects.map((project: any) => (
              <Card 
                key={`project-${project.id}-${project.updatedAt}`} 
                className="hover:shadow-xl transition-all duration-300 cursor-pointer group border-l-4 border-l-[#2699A6] bg-gradient-to-br from-white to-slate-50 overflow-hidden"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-4 bg-gradient-to-r from-[#2699A6]/5 to-transparent">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold group-hover:text-[#2699A6] transition-colors mb-2">
                        {language === 'ar' && project.nameAr 
                          ? project.nameAr 
                          : project.name
                        }
                      </CardTitle>
                      <div className="flex items-center flex-wrap gap-2">
                        <Badge 
                          variant={getStatusBadgeVariant(project.status)}
                          className="text-xs font-semibold"
                        >
                          {getStatusText(project.status)}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-medium ${getPriorityColor(project.priority)} border-current`}
                        >
                          {project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1)} Priority
                        </Badge>
                        {project.regulationType && (
                          <Badge variant="secondary" className="text-xs bg-[#2699A6]/10 text-[#2699A6] border border-[#2699A6]/20">
                            {project.regulationType.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Project Owner */}
                      {project.owner && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                          <UserAvatar user={project.owner} size="sm" />
                          <span className="font-medium">
                            {project.owner.firstName} {project.owner.lastName}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-white/70 hover:bg-white shadow-sm hover:shadow-md transition-all duration-200"
                        onClick={(e) => {
                          console.log('View button clicked for project:', project.id);
                          e.stopPropagation();
                          setLocation(`/projects/${project.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4 text-[#2699A6]" />
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full bg-white/70 hover:bg-white shadow-sm hover:shadow-md transition-all duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4 text-[#2699A6]" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              console.log('Edit button clicked for project:', project.id);
                              e.stopPropagation();
                              handleEdit(project);
                            }}
                            className="cursor-pointer"
                          >
                            <Edit className="h-4 w-4 mr-2 text-[#2699A6]" />
                            {language === 'ar' ? 'تعديل' : 'Edit Project'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(project)}
                            className="text-red-600 cursor-pointer focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {language === 'ar' ? 'حذف' : 'Delete Project'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {language === 'ar' && project.descriptionAr 
                      ? project.descriptionAr 
                      : project.description || (language === 'ar' ? 'لا يوجد وصف متاح' : 'No description available')
                    }
                  </p>
                  
                  {/* Progress Section */}
                  <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {language === 'ar' ? 'التقدم العام' : 'Overall Progress'}
                      </span>
                      <span className="text-lg font-bold text-[#2699A6]">
                        {project.realProgress}%
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                      <div 
                        className="bg-gradient-to-r from-[#2699A6] to-[#34d399] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${project.realProgress}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-slate-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                        {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
                      </div>
                      <span className="font-semibold text-slate-800">
                        {project.completedTaskCount || 0}/{project.taskCount || 0}
                      </span>
                    </div>
                  </div>
                  
                  {/* Project Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'تاريخ البداية' : 'Start Date'}
                      </span>
                      <p className="font-semibold text-slate-800">
                        {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <span className="text-slate-500 font-medium">
                        {language === 'ar' ? 'تاريخ الانتهاء' : 'Due Date'}
                      </span>
                      <p className={`font-semibold ${
                        project.endDate && new Date(project.endDate) < new Date() 
                          ? 'text-red-600' 
                          : 'text-slate-800'
                      }`}>
                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Footer Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center text-sm text-slate-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {language === 'ar' ? 'آخر تحديث:' : 'Updated:'} {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-[#2699A6]/5 border-[#2699A6]/20 text-[#2699A6] hover:bg-[#2699A6] hover:text-white transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/projects/${project.id}`);
                      }}
                    >
                      {language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}