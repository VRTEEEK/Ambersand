import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import TaskWizard from '@/components/tasks/TaskWizard';
import { ControlInfoDialog } from '@/components/tasks/ControlInfoDialog';
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
  X,
  MessageSquare,
  History,
  ChevronDown
} from 'lucide-react';

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in-progress', 'review', 'completed', 'blocked']).default('pending'),
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

const editFormSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in-progress', 'review', 'completed', 'blocked']),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});

type EditFormData = z.infer<typeof editFormSchema>;

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [isTaskEditDialogOpen, setIsTaskEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh key
  const [isControlInfoDialogOpen, setIsControlInfoDialogOpen] = useState(false);
  const [selectedControlForInfo, setSelectedControlForInfo] = useState<any>(null);

  // Edit form
  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      priority: 'medium',
      status: 'pending',
      dueDate: '',
      assigneeId: '',
    },
  });

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

  const { data: tasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['/api/tasks', { projectId: id }, refreshKey],
    queryFn: async () => {
      const response = await fetch(`/api/tasks?projectId=${id}&_t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: !!id,
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
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

  const { data: users, refetch: refetchUsers } = useQuery({
    queryKey: ['/api/users', refreshKey],
    queryFn: async () => {
      const response = await fetch(`/api/users?_t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
  });

  const { data: tasksWithControls, refetch: refetchTasksWithControls } = useQuery({
    queryKey: ['/api/tasks', id, 'with-controls', refreshKey],
    queryFn: async () => {
      if (!tasks) return [];
      
      const tasksWithControlsData = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const response = await fetch(`/api/tasks/${task.id}/controls?_t=${Date.now()}`);
            if (!response.ok) return { ...task, controls: [] };
            const controls = await response.json();
            return { ...task, controls };
          } catch (error) {
            console.error(`Failed to fetch controls for task ${task.id}:`, error);
            return { ...task, controls: [] };
          }
        })
      );
      
      return tasksWithControlsData;
    },
    enabled: !!tasks && tasks.length > 0,
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache
  });

  // Task creation is now handled by TaskWizard component

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
      setIsTaskWizardOpen(false);
      setSelectedControlId(null);
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
        // Keep the assigneeId as is - don't map it to assigneeEmail for updates
        // Map controlId to eccControlId for database compatibility
        eccControlId: data.controlId,
      };
      console.log('🔄 Final task data being sent to API:', taskData);
      console.log('🔄 Making PUT request to:', `/api/tasks/${data.id}`);
      const result = await apiRequest(`/api/tasks/${data.id}`, 'PUT', taskData);
      console.log('🔄 API response received:', result);
      return result;
    },
    onSuccess: async (data, variables) => {
      console.log('✅ updateTaskMutation.onSuccess called with:', { data, variables });
      // Force complete refresh by incrementing refresh key
      setRefreshKey(prev => prev + 1);
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

  // Edit form setup
  const editFormSchema = z.object({
    title: z.string().min(1, 'Task title is required'),
    titleAr: z.string().optional(),
    description: z.string().optional(),
    descriptionAr: z.string().optional(),
    status: z.enum(['pending', 'in-progress', 'review', 'completed', 'blocked']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    dueDate: z.string().optional(),
    assigneeId: z.string().optional(),
  });

  type EditFormData = z.infer<typeof editFormSchema>;

  const editForm = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      assigneeId: 'unassigned',
    },
  });

  // Update the form when selectedTask changes
  useEffect(() => {
    if (selectedTask) {
      editForm.reset({
        title: selectedTask.title || '',
        titleAr: selectedTask.titleAr || '',
        description: selectedTask.description || '',
        descriptionAr: selectedTask.descriptionAr || '',
        status: selectedTask.status || 'pending',
        priority: selectedTask.priority || 'medium',
        dueDate: selectedTask.dueDate || '',
        assigneeId: selectedTask.assigneeId || 'unassigned',
      });
    }
  }, [selectedTask, editForm]);

  const onEditSubmit = (data: EditFormData) => {
    if (!selectedTask) return;
    
    console.log('Edit form onSubmit called with:', data);
    const updateData = {
      ...data,
      id: selectedTask.id,
      assigneeId: data.assigneeId === 'unassigned' ? null : data.assigneeId,
    };
    console.log('About to call updateTaskMutation with:', updateData);
    updateTaskMutation.mutate(updateData as any);
  };

  const handleEditTask = (task: any) => {
    setSelectedTask(task);
    editForm.reset({
      title: task.title || '',
      titleAr: task.titleAr || '',
      description: task.description || '',
      descriptionAr: task.descriptionAr || '',
      priority: task.priority || 'medium',
      status: task.status || 'pending',
      dueDate: task.dueDate || '',
      assigneeId: task.assigneeId || '',
    });
    setIsEditDialogOpen(true);
  };

  // Query for task controls (for the edit dialog)
  const { data: taskControls } = useQuery({
    queryKey: ['/api/tasks', selectedTask?.id, 'controls'],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      const response = await fetch(`/api/tasks/${selectedTask.id}/controls`);
      if (!response.ok) throw new Error('Failed to fetch task controls');
      return response.json();
    },
    enabled: !!selectedTask?.id,
  });

  const handleCreateTask = (controlId?: number) => {
    setSelectedControlId(controlId || null);
    setIsTaskWizardOpen(true);
  };

  const selectedControl = projectControls?.find(
    (control: any) => control.eccControl.id === selectedControlId
  )?.eccControl;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'blocked': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-[#ea580b] text-white dark:bg-[#ea580b] dark:text-white';
      case 'high': return 'bg-[#ea580b] text-white dark:bg-[#ea580b] dark:text-white';
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

  const completedTasks = tasksWithControls?.filter((task: any) => task.status === 'completed').length || 0;
  const totalTasks = tasksWithControls?.length || 0;
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
            <Button onClick={() => handleCreateTask()} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'مهمة جديدة' : 'New Task'}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {language === 'ar' ? 'إجمالي الضوابط' : 'Total Controls'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{projectControls?.length || 0}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-teal-500 rounded-full mr-2"></div>
                      {language === 'ar' ? 'فعالة' : 'Active'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-teal-50 dark:bg-teal-900/20 rounded-lg flex items-center justify-center">
                  <Target className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {language === 'ar' ? 'إجمالي المهام' : 'Total Tasks'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{totalTasks}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      {language === 'ar' ? 'إجمالي' : 'Total'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{completedTasks}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      {language === 'ar' ? 'مكتملة' : 'Completed'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {language === 'ar' ? 'معدل الإكمال' : 'Completion Rate'}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{completionRate}%</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-gray-500 rounded-full mr-2"></div>
                      {language === 'ar' ? 'معدل' : 'Rate'}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                </div>
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
                  <Button onClick={() => handleCreateTask()} className="bg-teal-600 hover:bg-teal-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'إنشاء المهمة الأولى' : 'Create First Task'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {tasksWithControls?.map((task: any) => {
                  // Find the assigned user
                  const assignedUser = users?.find((user: any) => user.id === task.assigneeId);
                  
                  return (
                    <Card key={task.id} className="hover:shadow-lg transition-all duration-200 border-0 shadow-sm hover:shadow-teal-100 dark:hover:shadow-teal-900/20">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header with title */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                                {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                              </h3>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditTask(task)}
                              className="ml-2"
                            >
                              {language === 'ar' ? 'تعديل' : 'Edit'}
                            </Button>
                          </div>
                          
                          {/* Controls as badges */}
                          {task.controls && task.controls.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {task.controls.map((control: any) => (
                                <Badge 
                                  key={control.eccControl.id} 
                                  variant="outline" 
                                  className="text-xs font-medium bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300 cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-800/30 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleControlClick(control.eccControl);
                                  }}
                                >
                                  {control.eccControl.code}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Task Description */}
                          {task.description && (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
                              </p>
                            </div>
                          )}
                          
                          {/* Status and Priority Row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getStatusColor(task.status)}>
                              {task.status === 'pending' ? (language === 'ar' ? 'لم تبدأ' : 'Not Started') : 
                               task.status === 'in-progress' ? (language === 'ar' ? 'قيد التنفيذ' : 'In Progress') :
                               task.status === 'review' ? (language === 'ar' ? 'قيد المراجعة' : 'Under Review') :
                               task.status === 'completed' ? (language === 'ar' ? 'مكتملة' : 'Completed') :
                               (language === 'ar' ? 'محجوبة' : 'Blocked')}
                            </Badge>
                            <Badge 
                              className={`${
                                task.priority === 'urgent' || task.priority === 'high'
                                  ? 'bg-[#ea580b] text-white hover:bg-[#ea580b]/90 border-[#ea580b]' 
                                  : task.priority === 'medium'
                                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                  : 'bg-gray-500 text-white hover:bg-gray-600'
                              }`}
                            >
                              {task.priority === 'low' ? (language === 'ar' ? 'منخفضة' : 'Low') :
                               task.priority === 'medium' ? (language === 'ar' ? 'متوسطة' : 'Medium') :
                               task.priority === 'high' ? (language === 'ar' ? 'عالية' : 'High') :
                               (language === 'ar' ? 'عاجلة' : 'Urgent')}
                            </Badge>
                            {/* Assigned Person Badge */}
                            {assignedUser && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                <Users className="h-3 w-3 mr-1" />
                                {(assignedUser.firstName && assignedUser.lastName) 
                                  ? `${assignedUser.firstName} ${assignedUser.lastName}`
                                  : assignedUser.email?.split('@')[0] || 'Unknown User'}
                              </Badge>
                            )}
                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                {language === 'ar' ? 'تاريخ الإنشاء:' : 'Created:'} {' '}
                                {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            {task.controls && task.controls.length > 0 && (
                              <span className="text-xs text-teal-600 dark:text-teal-400">
                                {language === 'ar' ? 'انقر لعرض/رفع الأدلة' : 'Click to view/upload evidence'}
                              </span>
                            )}
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
                              <Badge variant="secondary" className="px-2 py-1 text-xs font-medium">
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
                              {(tasksWithControls?.filter((task: any) => 
                                task.controls?.some((taskControl: any) => taskControl.eccControl.id === control.eccControl.id)
                              ) || []).length} {language === 'ar' ? 'مهمة' : 'Tasks'}
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

        {/* Task Creation Wizard */}
        <TaskWizard
          isOpen={isTaskWizardOpen}
          onClose={() => setIsTaskWizardOpen(false)}
          preselectedProjectId={parseInt(id!)}
        />

        {/* Edit Task Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تعديل المهمة' : 'Edit Task'}
              </DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit, (errors) => {
                console.error('❌ Form validation errors:', errors);
                toast({
                  title: language === 'ar' ? 'خطأ في النموذج' : 'Form Error',
                  description: language === 'ar' ? 'يرجى التحقق من البيانات المدخلة' : 'Please check the form data',
                  variant: 'destructive',
                });
              })} className="space-y-4">
                {/* Project Information (Read-only) */}
                <div className="mb-4">
                  <Label className="text-sm font-medium mb-2 block">
                    {language === 'ar' ? 'معلومات المشروع' : 'Project Information'}
                  </Label>
                  <div className="p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {language === 'ar' && project.nameAr ? project.nameAr : project.name}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل العنوان' : 'Enter title'} {...field} />
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
                        <FormLabel>{language === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل العنوان بالعربية' : 'Enter title in Arabic'} {...field} />
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
                        <FormLabel>{language === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={language === 'ar' ? 'أدخل الوصف' : 'Enter description'} {...field} />
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
                        <FormLabel>{language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={language === 'ar' ? 'أدخل الوصف بالعربية' : 'Enter description in Arabic'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الحالة' : 'Status'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الحالة' : 'Select status'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'To Do'}</SelectItem>
                            <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                            <SelectItem value="review">{language === 'ar' ? 'للمراجعة' : 'Review'}</SelectItem>
                            <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                            <SelectItem value="blocked">{language === 'ar' ? 'محجوبة' : 'Blocked'}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الأولوية' : 'Priority'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الأولوية' : 'Select priority'} />
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
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormField
                    control={editForm.control}
                    name="assigneeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'المُكلف' : 'Assignee'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر المُكلف' : 'Select assignee'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">{language === 'ar' ? 'غير مُكلف' : 'Unassigned'}</SelectItem>
                            {users?.map((user: any) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName && user.lastName 
                                  ? `${user.firstName} ${user.lastName} (${user.email})`
                                  : user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Assigned Controls Section */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    {language === 'ar' ? 'الضوابط المُكلفة' : 'Assigned Controls'}
                  </Label>
                  <div className="min-h-[60px] p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                    {taskControls && taskControls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {taskControls.map((control: any) => (
                          <Badge key={control.eccControlId || control.id} variant="secondary" className="text-xs">
                            {control.eccControl?.code}: {language === 'ar' && control.eccControl?.controlAr 
                              ? control.eccControl.controlAr 
                              : control.eccControl?.controlEn}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {language === 'ar' ? 'لا توجد ضوابط مُكلفة' : 'No controls assigned'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateTaskMutation.isPending}
                  >
                    {updateTaskMutation.isPending ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Control Information Dialog */}
        <ControlInfoDialog
          isOpen={isControlInfoDialogOpen}
          onClose={() => {
            setIsControlInfoDialogOpen(false);
            setSelectedControlForInfo(null);
          }}
          control={selectedControlForInfo}
          projectId={project?.id || 0}
        />
      </div>
    </AppLayout>
  );
}
