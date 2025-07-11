import { useState } from 'react';
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
  Search, 
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

  // Calculate progress for each project
  const projectsWithProgress = projects?.map((project: any) => {
    const projectTasks = allTasks?.filter((task: any) => task.projectId === project.id) || [];
    const completedTasks = projectTasks.filter((task: any) => task.status === 'completed').length;
    const totalTasks = projectTasks.length;
    const realProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    return {
      ...project,
      realProgress,
      taskCount: totalTasks,
      completedTaskCount: completedTasks
    };
  }) || [];

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
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData & { id: number }) => {
      const { id, ...projectData } = data;
      return await apiRequest(`/api/projects/${id}`, 'PUT', projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
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

  const handleEdit = (project: any) => {
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
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (project: any) => {
    if (confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المشروع؟' : 'Are you sure you want to delete this project?')) {
      deleteProjectMutation.mutate(project.id);
    }
  };

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
    return matchesSearch && matchesStatus;
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={t('actions.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
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
                {searchTerm || statusFilter !== 'all' 
                  ? (language === 'ar' ? 'لم يتم العثور على مشاريع' : 'No projects found')
                  : (language === 'ar' ? 'لا توجد مشاريع' : 'No projects yet')
                }
              </h3>
              <p className="text-slate-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? (language === 'ar' ? 'جرب تغيير مرشحات البحث' : 'Try adjusting your search filters')
                  : (language === 'ar' ? 'يمكنك إنشاء مشروع من صفحة الأنظمة' : 'You can create projects from the Regulations page')
                }
              </p>
            </div>
          ) : (
            filteredProjects.map((project: any) => (
              <Card key={project.id} className="glass-card hover-lift cursor-pointer" onClick={() => setLocation(`/projects/${project.id}`)}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {language === 'ar' && project.nameAr ? project.nameAr : project.name}
                      </CardTitle>
                      <Badge variant={getStatusBadgeVariant(project.status)}>
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setLocation(`/projects/${project.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'عرض' : 'View'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(project)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'تعديل' : 'Edit'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(project)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {language === 'ar' ? 'حذف' : 'Delete'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {language === 'ar' && project.descriptionAr 
                        ? project.descriptionAr 
                        : project.description || 'No description available'
                      }
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Priority:</span>
                      <span className={`font-medium ${getPriorityColor(project.priority)}`}>
                        {project.priority?.charAt(0).toUpperCase() + project.priority?.slice(1)}
                      </span>
                    </div>
                    
                    {project.regulationType && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">Regulation:</span>
                        <Badge variant="outline">
                          {project.regulationType.toUpperCase()}
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Progress:</span>
                      <span className="font-medium">
                        {project.realProgress}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Tasks:</span>
                      <span className="font-medium">
                        {project.completedTaskCount || 0}/{project.taskCount || 0}
                      </span>
                    </div>
                    
                    {project.endDate && (
                      <div className="flex items-center text-sm text-slate-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        Due: {new Date(project.endDate).toLocaleDateString()}
                      </div>
                    )}
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