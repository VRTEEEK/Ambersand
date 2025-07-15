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
import TaskWizard from '@/components/tasks/TaskWizard';
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

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const { data: tasksWithControls } = useQuery({
    queryKey: ['/api/tasks', id, 'with-controls'],
    queryFn: async () => {
      if (!tasks) return [];
      
      const tasksWithControlsData = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const response = await fetch(`/api/tasks/${task.id}/controls`);
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
                    <Card key={task.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 border-0 shadow-sm hover:shadow-teal-100 dark:hover:shadow-teal-900/20">
                      <CardContent 
                        className="p-4"
                        onClick={() => {
                          setEditingTask(task);
                          setIsTaskEditDialogOpen(true);
                        }}
                      >
                        <div className="space-y-3">
                          {/* Header with title and assignee */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                                {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                              </h3>
                              {/* Assigned Person - Just icon and name */}
                              {assignedUser && (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <Users className="h-4 w-4" />
                                  <span className="font-medium">
                                    {assignedUser.firstName} {assignedUser.lastName}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Controls as badges */}
                          {task.controls && task.controls.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {task.controls.map((control: any) => (
                                <Badge 
                                  key={control.eccControl.id} 
                                  variant="outline" 
                                  className="text-xs font-medium bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300"
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
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'evidence'>('details');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch task controls
  const { data: taskControls } = useQuery({
    queryKey: ['/api/tasks', task.id, 'controls'],
    enabled: !!task.id,
  });

  // Fetch evidence versions and comments for each evidence
  const { data: evidenceVersions } = useQuery({
    queryKey: ['/api/evidence', 'versions', task.id],
    enabled: !!task.id,
  });

  const { data: evidenceComments } = useQuery({
    queryKey: ['/api/evidence', 'comments', task.id],
    enabled: !!task.id,
  });

  // Mutation for adding evidence comments
  const addCommentMutation = useMutation({
    mutationFn: async ({ evidenceId, comment }: { evidenceId: number; comment: string }) => {
      return apiRequest(`/api/evidence/${evidenceId}/comments`, {
        method: 'POST',
        body: { comment },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', 'comments', task.id] });
      toast({
        title: language === 'ar' ? 'تم إضافة التعليق' : 'Comment Added',
        description: language === 'ar' ? 'تم إضافة التعليق بنجاح' : 'Comment added successfully',
      });
    },
    onError: (error) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إضافة التعليق' : 'Failed to add comment',
        variant: 'destructive',
      });
    },
  });

  const handleAddComment = (evidenceId: number, comment: string) => {
    if (comment.trim()) {
      addCommentMutation.mutate({ evidenceId, comment: comment.trim() });
    }
  };

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

  const uploadEvidenceFiles = async () => {
    if (uploadedFiles.length === 0) return;
    if (!selectedControlId) {
      toast({
        title: language === 'ar' ? 'يرجى اختيار ضابط' : 'Please select a control',
        description: language === 'ar' ? 'يجب اختيار ضابط لربط الأدلة به' : 'You must select a control to associate evidence with',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('taskId', task.id.toString());
      formData.append('projectId', task.projectId.toString());
      formData.append('controlId', selectedControlId.toString());

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadedFiles([]);
      setSelectedControlId(null);
      // Invalidate evidence queries to refresh the display
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', 'versions', task.id] });
      // Show success toast
      toast({
        title: language === 'ar' ? 'تم رفع الملفات بنجاح' : 'Files Uploaded Successfully',
        description: language === 'ar' ? 'تم رفع الأدلة بنجاح' : 'Evidence files uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: language === 'ar' ? 'خطأ في رفع الملفات' : 'Upload Error',
        description: language === 'ar' ? 'فشل رفع الملفات' : 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {language === 'ar' 
            ? 'يمكنك تعديل تفاصيل المهمة أو إدارة الأدلة المرتبطة'
            : 'You can edit task details or manage associated evidence'}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'evidence')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">
            {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
          </TabsTrigger>
          <TabsTrigger value="evidence">
            {language === 'ar' ? 'الأدلة' : 'Evidence'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'اسم المهمة' : 'Task Name'}
              </label>
              <Input
                defaultValue={task.title}
                placeholder={language === 'ar' ? 'أدخل اسم المهمة' : 'Enter task name'}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الأولوية' : 'Priority'}
              </label>
              <Select defaultValue={task.priority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{language === 'ar' ? 'منخفضة' : 'Low'}</SelectItem>
                  <SelectItem value="medium">{language === 'ar' ? 'متوسطة' : 'Medium'}</SelectItem>
                  <SelectItem value="high">{language === 'ar' ? 'عالية' : 'High'}</SelectItem>
                  <SelectItem value="urgent">{language === 'ar' ? 'عاجلة' : 'Urgent'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'ar' ? 'الوصف' : 'Description'}
            </label>
            <Textarea
              defaultValue={task.description}
              placeholder={language === 'ar' ? 'أدخل وصف المهمة' : 'Enter task description'}
              rows={3}
              className="w-full"
            />
          </div>

          {/* Associated Controls */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'ar' ? 'الضوابط المرتبطة' : 'Associated Controls'}
            </label>
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              {taskControls && taskControls.length > 0 ? (
                <div className="space-y-3">
                  {taskControls.map((control: any) => (
                    <div key={control.id} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <Badge variant="secondary" className="mt-1">
                        {control.eccControl.code}
                      </Badge>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {language === 'ar' && control.eccControl.subdomainAr 
                            ? control.eccControl.subdomainAr 
                            : control.eccControl.subdomainEn}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {language === 'ar' && control.eccControl.controlAr 
                            ? control.eccControl.controlAr 
                            : control.eccControl.controlEn}
                        </p>
                        <div className="text-xs text-gray-500">
                          <span className="font-medium">
                            {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                          </span>
                          <span className="ml-1">
                            {language === 'ar' 
                              ? (control.eccControl.evidenceAr || 'وثائق ، سياسات ، إجراءات ، وأدلة تدقيق')
                              : (control.eccControl.evidenceEn || 'Documentation, policies, procedures, and audit evidence')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  {language === 'ar' ? 'لا توجد ضوابط مرتبطة' : 'No associated controls'}
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          {/* Evidence Upload Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {language === 'ar' ? 'رفع أدلة جديدة' : 'Upload New Evidence'}
            </h3>
            
            {/* Control Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'اختر الضابط' : 'Select Control'}
              </label>
              <Select onValueChange={(value) => setSelectedControlId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر ضابط...' : 'Select a control...'} />
                </SelectTrigger>
                <SelectContent>
                  {taskControls?.map((control: any) => (
                    <SelectItem key={control.id} value={control.eccControl.id.toString()}>
                      {control.eccControl.code} - {language === 'ar' && control.eccControl.subdomainAr 
                        ? control.eccControl.subdomainAr 
                        : control.eccControl.subdomainEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'اختر الملفات' : 'Select Files'}
              </label>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
                onChange={(e) => e.target.files && handleFileSelection(Array.from(e.target.files))}
                className="w-full p-2 border rounded-md"
              />
            </div>

            {/* Selected Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {language === 'ar' ? 'الملفات المختارة:' : 'Selected Files:'}
                </h4>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={uploadEvidenceFiles}
              disabled={uploading || uploadedFiles.length === 0 || !selectedControlId}
              className="w-full"
            >
              {uploading ? (
                language === 'ar' ? 'جاري الرفع...' : 'Uploading...'
              ) : (
                language === 'ar' ? 'رفع الأدلة' : 'Upload Evidence'
              )}
            </Button>
          </div>

          {/* Existing Evidence with Version History */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {language === 'ar' ? 'الأدلة الموجودة' : 'Existing Evidence'}
            </h3>
            
            {taskEvidence && taskEvidence.length > 0 ? (
              <div className="space-y-4">
                {taskEvidence.map((evidence: any) => (
                  <div key={evidence.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {evidence.title}
                          </h4>
                          <Badge variant="secondary" className="text-xs">
                            v{evidence.version}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {evidence.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{evidence.fileName}</span>
                          <span>•</span>
                          <span>{(evidence.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date(evidence.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          {language === 'ar' ? 'تحميل' : 'Download'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          // Toggle version history display
                          const elem = document.getElementById(`versions-${evidence.id}`);
                          if (elem) {
                            elem.style.display = elem.style.display === 'none' ? 'block' : 'none';
                          }
                        }}>
                          {language === 'ar' ? 'الإصدارات' : 'Versions'}
                        </Button>
                      </div>
                    </div>

                    {/* Version History */}
                    <div id={`versions-${evidence.id}`} style={{ display: 'none' }} className="mt-3 pt-3 border-t">
                      <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2 text-sm">
                        {language === 'ar' ? 'تاريخ الإصدارات' : 'Version History'}
                      </h5>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {evidenceVersions?.filter((v: any) => v.evidenceId === evidence.id).map((version: any) => (
                          <div key={version.id} className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-600 rounded">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">v{version.version}</span>
                              <span>•</span>
                              <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                              <span>•</span>
                              <span>{version.uploadedBy || 'Unknown'}</span>
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                              {language === 'ar' ? 'تحميل' : 'Download'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="mt-3 pt-3 border-t">
                      <h5 className="font-medium text-gray-800 dark:text-gray-200 mb-2 text-sm">
                        {language === 'ar' ? 'التعليقات' : 'Comments'}
                      </h5>
                      
                      {/* Existing Comments */}
                      <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                        {evidenceComments?.filter((c: any) => c.evidenceId === evidence.id).map((comment: any) => (
                          <div key={comment.id} className="text-xs p-2 bg-gray-100 dark:bg-gray-600 rounded">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-gray-800 dark:text-gray-200 mb-1">{comment.comment}</p>
                                <div className="text-gray-500 text-xs">
                                  <span>{comment.user?.firstName || 'Unknown'}</span>
                                  <span className="ml-2">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment */}
                      <div className="flex gap-2">
                        <Input
                          placeholder={language === 'ar' ? 'إضافة تعليق...' : 'Add a comment...'}
                          className="flex-1 text-sm"
                          id={`comment-${evidence.id}`}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                handleAddComment(evidence.id, input.value);
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const input = document.getElementById(`comment-${evidence.id}`) as HTMLInputElement;
                            if (input?.value.trim()) {
                              handleAddComment(evidence.id, input.value);
                              input.value = '';
                            }
                          }}
                          disabled={addCommentMutation.isPending}
                        >
                          {addCommentMutation.isPending ? (
                            language === 'ar' ? 'جاري الإضافة...' : 'Adding...'
                          ) : (
                            language === 'ar' ? 'إضافة' : 'Add'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {language === 'ar' ? 'لا توجد أدلة مرفوعة' : 'No evidence uploaded yet'}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          {language === 'ar' ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button onClick={() => onSubmit(task)} disabled={isLoading}>
          {isLoading ? (
            language === 'ar' ? 'جاري الحفظ...' : 'Saving...'
          ) : (
            language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'
          )}
        </Button>
      </div>
    </div>
  );
}
