import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AppLayout from '@/components/layout/AppLayout';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileText,
  Target,
  Users,
  Activity,
  X
} from 'lucide-react';

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in-progress', 'completed', 'blocked']).default('pending'),
  dueDate: z.string().optional(),
  assigneeEmail: z.string().optional().refine(
    (value) => {
      if (!value || value.trim() === '') return true;
      
      // Split by comma and validate each email
      const emails = value.split(',').map(email => email.trim());
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      return emails.every(email => {
        // Allow names without @ (just names) or valid emails
        return !email.includes('@') || emailRegex.test(email);
      });
    },
    {
      message: 'Please enter valid email addresses separated by commas (e.g., user1@domain.com, user2@domain.com) or names'
    }
  ),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  controlId: z.number().min(1, 'Please select a related control'),
});

type TaskFormData = z.infer<typeof taskSchema>;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [isTaskEditDialogOpen, setIsTaskEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
  });

  const { data: projectControls, isLoading: controlsLoading } = useQuery({
    queryKey: ['/api/projects', id, 'controls'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}/controls`);
      if (!response.ok) throw new Error('Failed to fetch project controls');
      return response.json();
    },
    enabled: !!id,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/tasks', { projectId: id }],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?projectId=${id}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: !!id,
  });

  const { data: taskEvidence, refetch: refetchEvidence } = useQuery({
    queryKey: ['/api/evidence', { taskId: editingTask?.id }],
    queryFn: async () => {
      console.log('🔍 Fetching evidence for task:', editingTask?.id);
      const response = await fetch(`/api/evidence?taskId=${editingTask?.id}`);
      if (!response.ok) throw new Error('Failed to fetch evidence');
      const data = await response.json();
      console.log('🔍 Evidence data received:', data);
      return data;
    },
    enabled: !!editingTask?.id,
  });

  const taskForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      priority: 'medium',
      status: 'pending',
      dueDate: '',
      assigneeEmail: '',
      domain: '',
      subdomain: '',
      controlId: selectedControlId || undefined,
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const taskData = {
        ...data,
        projectId: parseInt(id!),
        // Use the assigneeEmail as assigneeId for now
        assigneeId: data.assigneeEmail,
        // Map controlId to eccControlId for database compatibility
        eccControlId: data.controlId,
      };
      return await apiRequest('/api/tasks', 'POST', taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', { projectId: id }] });
      setIsTaskDialogOpen(false);
      setSelectedControlId(null);
      taskForm.reset();
      toast({
        title: language === 'ar' ? 'تم إنشاء المهمة' : 'Task Created',
        description: language === 'ar' ? 'تم إنشاء المهمة بنجاح' : 'Task created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task',
        variant: 'destructive',
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData & { id: number }) => {
      console.log('🔄 updateTaskMutation.mutationFn called with:', data);
      const taskData = {
        ...data,
        assigneeId: data.assigneeEmail,
        // Map controlId to eccControlId for database compatibility
        eccControlId: data.controlId,
      };
      console.log('🔄 Final task data being sent to API:', taskData);
      console.log('🔄 Making PUT request to:', `/api/tasks/${data.id}`);
      const result = await apiRequest(`/api/tasks/${data.id}`, 'PUT', taskData);
      console.log('🔄 API response received:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('✅ updateTaskMutation.onSuccess called with:', { data, variables });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', { projectId: id }] });
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', { taskId: editingTask?.id }] });
      setIsTaskEditDialogOpen(false);
      setEditingTask(null);
      toast({
        title: language === 'ar' ? 'تم تحديث المهمة' : 'Task Updated',
        description: language === 'ar' ? 'تم تحديث المهمة بنجاح' : 'Task updated successfully',
      });
    },
    onError: (error, variables) => {
      console.error('❌ updateTaskMutation.onError called with:', { error, variables });
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحديث المهمة' : 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/projects/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setLocation('/projects');
      toast({
        title: language === 'ar' ? 'تم حذف المشروع' : 'Project Deleted',
        description: language === 'ar' ? 'تم حذف المشروع بنجاح' : 'Project deleted successfully',
      });
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حذف المشروع' : 'Failed to delete project',
        variant: 'destructive',
      });
    },
  });

  const onTaskSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleCreateTask = (controlId?: number) => {
    setSelectedControlId(controlId || null);
    
    if (controlId) {
      const selectedControl = projectControls?.find((control: any) => control.eccControl.id === controlId);
      if (selectedControl) {
        const domain = language === 'ar' && selectedControl.eccControl.domainAr 
          ? selectedControl.eccControl.domainAr 
          : selectedControl.eccControl.domainEn;
        const subdomain = language === 'ar' && selectedControl.eccControl.subdomainAr 
          ? selectedControl.eccControl.subdomainAr 
          : selectedControl.eccControl.subdomainEn;
        
        taskForm.setValue('domain', domain);
        taskForm.setValue('subdomain', subdomain);
        taskForm.setValue('controlId', controlId);
      }
    } else {
      taskForm.setValue('controlId', undefined);
    }
    
    setIsTaskDialogOpen(true);
  };

  const selectedControl = projectControls?.find(
    (control: any) => control.eccControl.id === taskForm.watch('controlId')
  )?.eccControl;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  if (projectLoading || controlsLoading || tasksLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-8">
          <p className="text-gray-500">Project not found</p>
        </div>
      </AppLayout>
    );
  }

  const completedTasks = tasks?.filter((task: any) => task.status === 'completed').length || 0;
  const totalTasks = tasks?.length || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group controls by domain
  const groupedControls = projectControls?.reduce((acc: any, control: any) => {
    const domain = language === 'ar' ? control.eccControl.domainAr : control.eccControl.domainEn;
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(control);
    return acc;
  }, {}) || {};

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/projects')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {language === 'ar' && project.nameAr ? project.nameAr : project.name}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {language === 'ar' && project.descriptionAr ? project.descriptionAr : project.description}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">ECC</Badge>
                <span className="text-sm text-gray-500">
                  {language === 'ar' ? 'تم الإنشاء:' : 'Created:'} {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handleCreateTask()} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'مهمة جديدة' : 'New Task'}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteProjectMutation.mutate()}
              disabled={deleteProjectMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'حذف المشروع' : 'Delete Project'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">{projectControls?.length || 0}</p>
                </div>
                <Target className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'إجمالي المهام' : 'Total Tasks'}
                  </p>
                  <p className="text-2xl font-bold text-orange-600">{totalTasks}</p>
                </div>
                <Activity className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'معدل الإكمال' : 'Completion Rate'}
                  </p>
                  <p className="text-2xl font-bold text-purple-600">{completionRate}%</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks">
              {language === 'ar' ? 'المهام' : 'Tasks'}
            </TabsTrigger>
            <TabsTrigger value="controls">
              {language === 'ar' ? 'الضوابط' : 'Controls'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {totalTasks === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Activity className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {language === 'ar' ? 'لا توجد مهام حتى الآن' : 'No Tasks Yet'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {language === 'ar' ? 'لم يتم إنشاء أي مهام لهذا المشروع بعد.' : 'No tasks have been created for this project yet.'}
                  </p>
                  <Button onClick={() => handleCreateTask()} className="bg-teal-600 hover:bg-teal-700">
                    <Plus className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'إنشاء المهمة الأولى' : 'Create First Task'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {tasks?.map((task: any) => {
                  // Find the associated control
                  const taskControl = projectControls?.find((control: any) => control.eccControl.id === task.controlId);
                  
                  return (
                    <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent 
                        className="p-6"
                        onClick={() => {
                          setEditingTask(task);
                          setIsTaskEditDialogOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                              </h3>
                              {taskControl && (
                                <Badge className="bg-teal-600 text-white text-xs">
                                  {taskControl.eccControl.code}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Control Information */}
                            {taskControl && (
                              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 mb-3 text-sm border border-teal-200 dark:border-teal-800">
                                <div className="font-medium text-teal-800 dark:text-teal-200 mb-3 flex items-center gap-2">
                                  <Target className="h-4 w-4" />
                                  {language === 'ar' ? 'الضابط المرتبط:' : 'Associated Control:'}
                                </div>
                                
                                <div className="space-y-3">
                                  {/* Control Code and Title */}
                                  <div className="flex items-start gap-3">
                                    <span className="bg-teal-600 text-white px-2 py-1 rounded text-xs font-medium">
                                      {taskControl.eccControl.code}
                                    </span>
                                    <div className="flex-1">
                                      <p className="font-medium text-teal-900 dark:text-teal-100 text-sm leading-tight">
                                        {language === 'ar' && taskControl.eccControl.controlAr 
                                          ? taskControl.eccControl.controlAr 
                                          : taskControl.eccControl.controlEn}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Domain and Subdomain */}
                                  <div className="grid grid-cols-1 gap-2 text-teal-700 dark:text-teal-300">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{language === 'ar' ? 'المجال:' : 'Domain:'}</span>
                                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                                        {language === 'ar' && taskControl.eccControl.domainAr ? taskControl.eccControl.domainAr : taskControl.eccControl.domainEn}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{language === 'ar' ? 'المجال الفرعي:' : 'Subdomain:'}</span>
                                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                                        {language === 'ar' && taskControl.eccControl.subdomainAr ? taskControl.eccControl.subdomainAr : taskControl.eccControl.subdomainEn}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Implementation Guidance */}
                                  {(taskControl.eccControl.implementationGuidanceEn || taskControl.eccControl.implementationGuidanceAr) && (
                                    <div className="bg-white dark:bg-gray-800 rounded p-3 border border-teal-200 dark:border-teal-700">
                                      <h4 className="font-medium text-teal-800 dark:text-teal-200 mb-2 text-xs">
                                        {language === 'ar' ? 'إرشادات التنفيذ:' : 'Implementation Guidance:'}
                                      </h4>
                                      <p className="text-xs text-teal-700 dark:text-teal-300 line-clamp-3">
                                        {language === 'ar' && taskControl.eccControl.implementationGuidanceAr 
                                          ? taskControl.eccControl.implementationGuidanceAr 
                                          : taskControl.eccControl.implementationGuidanceEn}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Evidence Requirements */}
                                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 border border-blue-200 dark:border-blue-700">
                                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2 text-xs flex items-center gap-2">
                                      <FileText className="h-3 w-3" />
                                      {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                                    </h4>
                                    <p className="text-xs text-blue-700 dark:text-blue-300 line-clamp-2">
                                      {language === 'ar' && taskControl.eccControl.evidenceRequirementsAr 
                                        ? taskControl.eccControl.evidenceRequirementsAr 
                                        : taskControl.eccControl.evidenceRequirementsEn || 
                                          (language === 'ar' ? 'وثائق، سياسات، إجراءات، وأدلة تدقيق' : 'Documentation, policies, procedures, and audit evidence')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Task Description */}
                            {task.description && (
                              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-700">
                                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2 text-sm">
                                  {language === 'ar' ? 'وصف المهمة:' : 'Task Description:'}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
                                </p>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={getStatusColor(task.status)}>
                                {task.status === 'pending' ? (language === 'ar' ? 'لم تبدأ' : 'Not Started') : 
                                 task.status === 'in-progress' ? (language === 'ar' ? 'قيد التنفيذ' : 'In Progress') :
                                 task.status === 'completed' ? (language === 'ar' ? 'مكتملة' : 'Completed') :
                                 (language === 'ar' ? 'محجوبة' : 'Blocked')}
                              </Badge>
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority === 'low' ? (language === 'ar' ? 'منخفضة' : 'Low') :
                                 task.priority === 'medium' ? (language === 'ar' ? 'متوسطة' : 'Medium') :
                                 task.priority === 'high' ? (language === 'ar' ? 'عالية' : 'High') :
                                 (language === 'ar' ? 'عاجلة' : 'Urgent')}
                              </Badge>
                              {task.assigneeId && (
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Users className="h-3 w-3" />
                                  <span className="truncate max-w-40" title={task.assigneeId}>
                                    {task.assigneeId.length > 30 
                                      ? `${task.assigneeId.substring(0, 30)}...` 
                                      : task.assigneeId
                                    }
                                  </span>
                                  {task.assigneeId.includes(',') && (
                                    <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">
                                      {task.assigneeId.split(',').length} {language === 'ar' ? 'أشخاص' : 'people'}
                                    </span>
                                  )}
                                </div>
                              )}
                              {task.dueDate && (
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>

                            {/* Task Metadata */}
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {language === 'ar' ? 'تاريخ الإنشاء:' : 'Created:'} {' '}
                                      {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'}
                                    </span>
                                  </div>
                                  {task.updatedAt && task.updatedAt !== task.createdAt && (
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>
                                        {language === 'ar' ? 'آخر تحديث:' : 'Updated:'} {' '}
                                        {new Date(task.updatedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400">
                                  ID: {task.id}
                                </div>
                              </div>
                              
                              {/* Evidence Indicator */}
                              {taskControl && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <FileText className="h-3 w-3" />
                                  <span>
                                    {language === 'ar' ? 'انقر لعرض/رفع الأدلة المطلوبة' : 'Click to view/upload required evidence'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            {Object.entries(groupedControls).map(([domain, controls]) => (
              <div key={domain} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {domain}
                  </h2>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {(controls as any[]).length} {language === 'ar' ? 'ضابط' : 'Controls'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(controls as any[]).map((control: any) => {
                    const controlTasks = tasks?.filter((task: any) => task.controlId === control.eccControl.id) || [];
                    return (
                      <Card key={control.id} className="relative hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500" 
                                defaultChecked 
                                disabled
                              />
                              <Badge className="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 text-xs font-medium">
                                {control.eccControl.code}
                              </Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 leading-tight">
                                {language === 'ar' && control.eccControl.subdomainAr 
                                  ? control.eccControl.subdomainAr 
                                  : control.eccControl.subdomainEn || control.eccControl.titleEn || control.eccControl.titleAr}
                              </h3>
                              
                              {/* Control Description */}
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                                {language === 'ar' && control.eccControl.controlAr 
                                  ? control.eccControl.controlAr 
                                  : control.eccControl.controlEn || 'No description available'}
                              </p>
                              
                              {/* Implementation Guidance */}
                              {(control.eccControl.implementationGuidanceEn || control.eccControl.implementationGuidanceAr) && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                  {language === 'ar' && control.eccControl.implementationGuidanceAr 
                                    ? control.eccControl.implementationGuidanceAr 
                                    : control.eccControl.implementationGuidanceEn}
                                </p>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-medium">
                                  {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'}
                                </span>
                                <span className="ml-1">
                                  {language === 'ar' 
                                    ? (control.eccControl.evidenceAr || control.eccControl.evidenceRequiredAr || 'وثائق ، سياسات ، إجراءات ، وأدلة تدقيق')
                                    : (control.eccControl.evidenceEn || control.eccControl.evidenceRequiredEn || 'Documentation, policies, procedures, and audit evidence')}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <Badge variant="outline" className="text-xs">
                              {(tasks?.filter((task: any) => task.eccControlId === control.eccControl.id) || []).length} {language === 'ar' ? 'مهمة' : 'Tasks'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateTask(control.eccControl.id)}
                              className="text-xs px-2 py-1 h-6"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {language === 'ar' ? 'إضافة مهمة' : 'Add Task'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        {/* Task Creation Dialog */}
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'قم بإنشاء مهمة جديدة وتعيينها لضابط محدد' : 'Create a new task and assign it to a specific control'}
              </DialogDescription>
            </DialogHeader>
            <Form {...taskForm}>
              <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-6">
                <FormField
                  control={taskForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {language === 'ar' ? 'اسم المهمة' : 'Task Name'} 
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={language === 'ar' ? 'أدخل اسم المهمة' : 'Enter task name'}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={taskForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {language === 'ar' ? 'الوصف' : 'Description'}
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder={language === 'ar' ? 'أدخل وصف المهمة' : 'Enter task description'}
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Hierarchical Control Selection */}
                <div className="space-y-4">
                  {/* Domain Selection */}
                  <FormField
                    control={taskForm.control}
                    name="domain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {language === 'ar' ? 'المجال' : 'Domain'} 
                          <span className="text-red-500 ml-1">*</span>
                        </FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          // Reset subdomain and control when domain changes
                          taskForm.setValue('subdomain', '');
                          taskForm.setValue('controlId', undefined);
                          setSelectedControlId(null);
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر المجال' : 'Select a domain'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[...new Set(projectControls?.map((control: any) => 
                              language === 'ar' && control.eccControl.domainAr 
                                ? control.eccControl.domainAr 
                                : control.eccControl.domainEn
                            ))].map((domain: string) => (
                              <SelectItem key={domain} value={domain}>
                                {domain}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Subdomain Selection */}
                  {taskForm.watch('domain') && (
                    <FormField
                      control={taskForm.control}
                      name="subdomain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            {language === 'ar' ? 'المجال الفرعي' : 'Subdomain'} 
                            <span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <Select onValueChange={(value) => {
                            field.onChange(value);
                            // Reset control when subdomain changes
                            taskForm.setValue('controlId', undefined);
                            setSelectedControlId(null);
                          }} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={language === 'ar' ? 'اختر المجال الفرعي' : 'Select a subdomain'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[...new Set(projectControls
                                ?.filter((control: any) => {
                                  const controlDomain = language === 'ar' && control.eccControl.domainAr 
                                    ? control.eccControl.domainAr 
                                    : control.eccControl.domainEn;
                                  return controlDomain === taskForm.watch('domain');
                                })
                                ?.map((control: any) => 
                                  language === 'ar' && control.eccControl.subdomainAr 
                                    ? control.eccControl.subdomainAr 
                                    : control.eccControl.subdomainEn
                                ))].map((subdomain: string) => (
                                <SelectItem key={subdomain} value={subdomain}>
                                  {subdomain}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Control Selection */}
                  {taskForm.watch('subdomain') && (
                    <FormField
                      control={taskForm.control}
                      name="controlId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">
                            {language === 'ar' ? 'الضابط' : 'Control'} 
                            <span className="text-red-500 ml-1">*</span>
                          </FormLabel>
                          <Select onValueChange={(value) => {
                            const controlId = parseInt(value);
                            field.onChange(controlId);
                            setSelectedControlId(controlId);
                          }} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={language === 'ar' ? 'اختر الضابط' : 'Select a control'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {projectControls
                                ?.filter((control: any) => {
                                  const controlDomain = language === 'ar' && control.eccControl.domainAr 
                                    ? control.eccControl.domainAr 
                                    : control.eccControl.domainEn;
                                  const controlSubdomain = language === 'ar' && control.eccControl.subdomainAr 
                                    ? control.eccControl.subdomainAr 
                                    : control.eccControl.subdomainEn;
                                  return controlDomain === taskForm.watch('domain') && 
                                         controlSubdomain === taskForm.watch('subdomain');
                                })
                                ?.map((control: any) => (
                                  <SelectItem key={control.eccControl.id} value={control.eccControl.id.toString()}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {control.eccControl.code} - {language === 'ar' && control.eccControl.controlAr 
                                          ? control.eccControl.controlAr 
                                          : control.eccControl.controlEn}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                

                <FormField
                  control={taskForm.control}
                  name="assigneeEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {language === 'ar' ? 'المُكلف' : 'Assigned To'}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder={language === 'ar' 
                            ? 'أدخل الأسماء أو الإيميلات مفصولة بفواصل (مثال: أحمد، sara@company.com، محمد)'
                            : 'Enter names or emails separated by commas (e.g., John, sara@company.com, Ahmed)'
                          }
                        />
                      </FormControl>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {language === 'ar' 
                          ? 'يمكنك إدخال عدة أسماء أو عناوين بريد إلكتروني مفصولة بفواصل'
                          : 'You can enter multiple names or email addresses separated by commas'
                        }
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={taskForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">
                          {language === 'ar' ? 'الحالة' : 'Status'}
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'Not Started'}</SelectItem>
                            <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                            <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                            <SelectItem value="blocked">{language === 'ar' ? 'محجوبة' : 'Blocked'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
                    <span className="font-medium">
                      {language === 'ar' ? 'معاينة الحالة:' : 'Status Preview:'}
                    </span>
                    <Badge className={getStatusColor(taskForm.watch('status'))}>
                      {taskForm.watch('status') === 'pending' ? (language === 'ar' ? 'لم تبدأ' : 'Not Started') : 
                       taskForm.watch('status') === 'in-progress' ? (language === 'ar' ? 'قيد التنفيذ' : 'In Progress') :
                       taskForm.watch('status') === 'completed' ? (language === 'ar' ? 'مكتملة' : 'Completed') :
                       (language === 'ar' ? 'محجوبة' : 'Blocked')}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsTaskDialogOpen(false);
                        setSelectedControlId(null);
                        taskForm.reset();
                      }}
                      className="px-6"
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createTaskMutation.isPending}
                      className="bg-teal-600 hover:bg-teal-700 px-6"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {createTaskMutation.isPending ? (
                        language === 'ar' ? 'جاري الإنشاء...' : 'Creating...'
                      ) : (
                        language === 'ar' ? 'إنشاء المهمة' : 'Create Task'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Task Edit Dialog */}
        <Dialog open={isTaskEditDialogOpen} onOpenChange={setIsTaskEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تعديل المهمة' : 'Edit Task'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'تعديل تفاصيل المهمة والضابط المرتبط بها' : 'Edit task details and associated control information'}
              </DialogDescription>
            </DialogHeader>
            {editingTask && (
              <EditTaskForm 
                task={editingTask}
                projectControls={projectControls}
                taskEvidence={taskEvidence}
                onSubmit={async (data) => {
                  console.log('Edit form onSubmit called with:', data);
                  try {
                    console.log('About to call updateTaskMutation with:', { ...data, id: editingTask.id });
                    await updateTaskMutation.mutateAsync({ ...data, id: editingTask.id });
                    console.log('updateTaskMutation completed successfully');
                  } catch (error) {
                    console.error('updateTaskMutation failed:', error);
                    throw error;
                  }
                }}
                onCancel={() => {
                  setIsTaskEditDialogOpen(false);
                  setEditingTask(null);
                }}
                isLoading={updateTaskMutation.isPending}
                language={language}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Task Edit Form Component
function EditTaskForm({ 
  task, 
  projectControls, 
  taskEvidence,
  onSubmit, 
  onCancel, 
  isLoading, 
  language 
}: {
  task: any;
  projectControls: any[];
  taskEvidence: any[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  language: string;
}) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileSelection = (files: File[]) => {
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'text/plain'
      ];
      
      return file.size <= maxSize && allowedTypes.includes(file.type);
    });

    if (validFiles.length !== files.length) {
      console.warn('Some files were rejected due to size or type restrictions');
    }

    setUploadedFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Limit to 10 files
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadEvidenceFiles = async (taskId: number) => {
    if (uploadedFiles.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('taskId', taskId.toString());
      formData.append('projectId', task.projectId.toString());

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadedFiles([]);
      // Invalidate evidence queries to refresh the display
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      // Show success toast
      toast({
        title: language === 'ar' ? 'تم رفع الملفات بنجاح' : 'Files Uploaded Successfully',
        description: language === 'ar' ? 'تم رفع الأدلة بنجاح' : 'Evidence files uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: language === 'ar' ? 'خطأ في رفع الملفات' : 'File Upload Error',
        description: language === 'ar' ? 'فشل في رفع الملفات. يرجى المحاولة مرة أخرى' : 'Failed to upload files. Please try again',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };
  
  // Get control details for pre-filling domain/subdomain
  const taskControl = projectControls?.find(
    (control: any) => control.eccControl.id === task.eccControlId
  )?.eccControl;

  const editForm = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task.title || '',
      titleAr: task.titleAr || '',
      description: task.description || '',
      descriptionAr: task.descriptionAr || '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      assigneeEmail: task.assigneeId || '',
      domain: task.domain || taskControl?.domain || '',
      subdomain: task.subdomain || taskControl?.subdomain || '',
      controlId: task.eccControlId || undefined,
    },
  });

  const selectedEditControl = projectControls?.find(
    (control: any) => control.eccControl.id === editForm.watch('controlId')
  )?.eccControl;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Get the assigned control details - watch form value for real-time updates
  const watchedControlId = editForm.watch('controlId');
  const assignedControl = watchedControlId ? projectControls?.find(
    (control: any) => control.eccControl.id === watchedControlId
  )?.eccControl : null;

  return (
    <Form {...editForm}>
      <form onSubmit={editForm.handleSubmit(async (data) => {
        console.log('📝 Form submitted with data:', data);
        console.log('📝 Form validation errors:', editForm.formState.errors);
        
        try {
          // First update the task
          console.log('Calling onSubmit with data:', data);
          await onSubmit(data);
          console.log('Task updated successfully');
          
          // Then upload files after successful task update
          if (uploadedFiles.length > 0) {
            console.log('Uploading files...');
            await uploadEvidenceFiles(task.id);
            console.log('Files uploaded successfully');
          }
          
          // Show success toast
          toast({
            title: language === 'ar' ? 'تم تحديث المهمة بنجاح' : 'Task Updated Successfully',
            description: language === 'ar' ? 'تم تحديث المهمة والأدلة بنجاح' : 'Task and evidence updated successfully',
          });
        } catch (error) {
          console.error('Error updating task:', error);
          toast({
            title: language === 'ar' ? 'خطأ في تحديث المهمة' : 'Task Update Error',
            description: language === 'ar' ? 'فشل في تحديث المهمة' : 'Failed to update task',
            variant: 'destructive',
          });
        }
      })} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={editForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'العنوان (بالإنجليزية)' : 'Title (English)'}
                  <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={language === 'ar' ? 'أدخل عنوان المهمة' : 'Enter task title'} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={editForm.control}
            name="titleAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'العنوان (بالعربية)' : 'Title (Arabic)'}
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder={language === 'ar' ? 'أدخل عنوان المهمة بالعربية' : 'Enter task title in Arabic'} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={editForm.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'الوصف (بالإنجليزية)' : 'Description (English)'}
                </FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder={language === 'ar' ? 'أدخل وصف المهمة' : 'Enter task description'} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={editForm.control}
            name="descriptionAr"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'الوصف (بالعربية)' : 'Description (Arabic)'}
                </FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder={language === 'ar' ? 'أدخل وصف المهمة بالعربية' : 'Enter task description in Arabic'} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={editForm.control}
          name="assigneeEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium">
                {language === 'ar' ? 'المُكلف' : 'Assigned To'}
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  placeholder={language === 'ar' 
                    ? 'أدخل الأسماء أو الإيميلات مفصولة بفواصل (مثال: أحمد، sara@company.com، محمد)'
                    : 'Enter names or emails separated by commas (e.g., John, sara@company.com, Ahmed)'
                  }
                />
              </FormControl>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {language === 'ar' 
                  ? 'يمكنك إدخال عدة أسماء أو عناوين بريد إلكتروني مفصولة بفواصل'
                  : 'You can enter multiple names or email addresses separated by commas'
                }
              </div>
              <FormMessage />
            </FormItem>
          )}
        />



        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={editForm.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                </FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={editForm.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'الأولوية' : 'Priority'}
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
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
            control={editForm.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium">
                  {language === 'ar' ? 'الحالة' : 'Status'}
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'Not Started'}</SelectItem>
                    <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                    <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                    <SelectItem value="blocked">{language === 'ar' ? 'محجوبة' : 'Blocked'}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Assigned Control Information */}
        {assignedControl && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
              <Target className="h-4 w-4" />
              {language === 'ar' ? 'الضابط المرتبط' : 'Associated Control'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'الرمز:' : 'Code:'}
                </span>
                <span className="ml-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
                  {assignedControl.code}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'المجال:' : 'Domain:'}
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {language === 'ar' && assignedControl.domainAr ? assignedControl.domainAr : assignedControl.domainEn}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'المجال الفرعي:' : 'Subdomain:'}
                </span>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  {language === 'ar' && assignedControl.subdomainAr ? assignedControl.subdomainAr : assignedControl.subdomainEn}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {language === 'ar' ? 'وصف الضابط:' : 'Control Description:'}
                </span>
                <p className="mt-1 text-gray-600 dark:text-gray-400 text-sm">
                  {language === 'ar' && assignedControl.controlAr ? assignedControl.controlAr : assignedControl.controlEn}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Requirements and Upload Section */}
        {assignedControl && (
          <div className="border-t pt-6">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {language === 'ar' ? 'متطلبات الأدلة ورفع الملفات' : 'Evidence Requirements & File Upload'}
            </h4>
            
            {/* Detailed Evidence Requirements */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <h5 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                {language === 'ar' ? 'الأدلة المطلوبة لهذا الضابط' : 'Required Evidence for This Control'}
              </h5>
              
              <div className="space-y-4">
                <div>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm leading-relaxed">
                    {language === 'ar' 
                      ? (assignedControl.evidenceAr || assignedControl.evidenceRequiredAr || 'وثائق ، سياسات ، إجراءات ، وأدلة تدقيق تدعم تطبيق هذا الضابط')
                      : (assignedControl.evidenceEn || assignedControl.evidenceRequiredEn || 'Documentation, policies, procedures, and audit evidence supporting implementation of this control')}
                  </p>
                </div>
                
                {/* Specific Evidence Types */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                    <h6 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      {language === 'ar' ? 'الوثائق المطلوبة:' : 'Required Documents:'}
                    </h6>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• {language === 'ar' ? 'السياسات والإجراءات ذات الصلة' : 'Relevant policies and procedures'}</li>
                      <li>• {language === 'ar' ? 'تقارير التدقيق الداخلي والخارجي' : 'Internal and external audit reports'}</li>
                      <li>• {language === 'ar' ? 'سجلات التدريب والتوعية' : 'Training and awareness records'}</li>
                      <li>• {language === 'ar' ? 'نتائج التقييمات والاختبارات' : 'Assessment and testing results'}</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                    <h6 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      {language === 'ar' ? 'الأدلة التطبيقية:' : 'Implementation Evidence:'}
                    </h6>
                    <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• {language === 'ar' ? 'لقطات شاشة للأنظمة والتطبيقات' : 'System and application screenshots'}</li>
                      <li>• {language === 'ar' ? 'سجلات النظام والأحداث' : 'System and event logs'}</li>
                      <li>• {language === 'ar' ? 'تقارير المراقبة والتنبيهات' : 'Monitoring and alerting reports'}</li>
                      <li>• {language === 'ar' ? 'إعدادات الأمان والضوابط' : 'Security settings and controls'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="space-y-4">
                <div 
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-teal-400 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-teal-400');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-teal-400');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-teal-400');
                    const files = Array.from(e.dataTransfer.files);
                    handleFileSelection(files);
                  }}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
                    className="hidden"
                    id="evidence-upload"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      handleFileSelection(files);
                    }}
                  />
                  <label htmlFor="evidence-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-teal-100 dark:bg-teal-900 p-3 rounded-full">
                        <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                      </div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        {language === 'ar' ? 'اضغط لاختيار الملفات أو اسحبها هنا' : 'Click to select files or drag them here'}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {language === 'ar' 
                          ? 'PDF, Word, Excel, PowerPoint, Images (حتى 10 ملفات، 10 ميجا بايت لكل ملف)'
                          : 'PDF, Word, Excel, PowerPoint, Images (up to 10 files, 10MB each)'}
                      </p>
                    </div>
                  </label>
                </div>

                {/* Selected Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-700 dark:text-gray-300">
                      {language === 'ar' ? 'الملفات المحددة للرفع:' : 'Selected Files for Upload:'}
                    </h5>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Previously Uploaded Evidence */}
                <div className="space-y-2">
                  <h5 className="font-medium text-gray-700 dark:text-gray-300">
                    {language === 'ar' ? 'الأدلة المرفوعة سابقاً:' : 'Previously Uploaded Evidence:'}
                  </h5>
                  {taskEvidence && taskEvidence.length > 0 ? (
                    <div className="space-y-2">
                      {taskEvidence.map((evidence: any) => (
                        <div key={evidence.id} className="flex items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{evidence.fileName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {evidence.fileSize ? `${(evidence.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'Unknown size'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/api/evidence/${evidence.id}/download`, '_blank')}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {language === 'ar' ? 'تحميل' : 'Download'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (confirm(language === 'ar' ? 'هل تريد حذف هذا الملف؟' : 'Are you sure you want to delete this file?')) {
                                  try {
                                    await apiRequest(`/api/evidence/${evidence.id}`, 'DELETE');
                                    // Refresh evidence list
                                    queryClient.invalidateQueries({ queryKey: ['/api/evidence', { taskId: editingTask?.id }] });
                                  } catch (error) {
                                    console.error('Error deleting evidence:', error);
                                  }
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                      {language === 'ar' ? 'لا توجد أدلة مرفوعة بعد' : 'No evidence uploaded yet'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
            <span className="font-medium">
              {language === 'ar' ? 'معاينة الحالة:' : 'Status Preview:'}
            </span>
            <Badge className={getStatusColor(editForm.watch('status'))}>
              {editForm.watch('status') === 'pending' ? (language === 'ar' ? 'لم تبدأ' : 'Not Started') : 
               editForm.watch('status') === 'in-progress' ? (language === 'ar' ? 'قيد التنفيذ' : 'In Progress') :
               editForm.watch('status') === 'completed' ? (language === 'ar' ? 'مكتملة' : 'Completed') :
               (language === 'ar' ? 'محجوبة' : 'Blocked')}
            </Badge>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="px-6"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || uploading}
              className="bg-teal-600 hover:bg-teal-700 px-6"
              onClick={() => {
                console.log('🔥 Submit button clicked!');
                console.log('📝 Form state:', editForm.formState);
                console.log('📝 Form values:', editForm.getValues());
                console.log('📝 Form errors:', editForm.formState.errors);
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              {isLoading || uploading ? (
                language === 'ar' ? 'جاري التحديث...' : 'Updating...'
              ) : (
                language === 'ar' ? 'تحديث المهمة' : 'Update Task'
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}