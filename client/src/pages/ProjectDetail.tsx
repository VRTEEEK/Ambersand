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
import { Label } from '@/components/ui/label';
import { getWorkflow, setRoute, submitStep, returnTo, approve, reject, WorkflowSnapshot } from '@/lib/api/workflows';
import ReturnDialog from '@/components/workflow/ReturnDialog';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/useAuth';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TaskWizard from '@/components/tasks/TaskWizard';
import { ControlInfoDialog } from '@/components/tasks/ControlInfoDialog';
import { ExportComplianceDialog } from '@/components/export/ExportComplianceDialog';
import Comments from '@/components/comments/Comments';
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
  ChevronDown,
  Search,
  Download
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
  
  // Get domain from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const domainFromUrl = urlParams.get('domain');
  const { t, language } = useI18n();
  
  // State for active tab - start with controls if domain specified
  const [activeTab, setActiveTab] = useState(domainFromUrl ? 'controls' : 'tasks');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [isTaskEditDialogOpen, setIsTaskEditDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Force refresh key
  const [isControlInfoDialogOpen, setIsControlInfoDialogOpen] = useState(false);
  const [selectedControlForInfo, setSelectedControlForInfo] = useState<any>(null);
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');

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
      console.log('🔄 ProjectDetail: Fetching tasks for project:', id, 'with refreshKey:', refreshKey);
      const response = await fetch(`/api/tasks?projectId=${id}&_t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      console.log('✅ ProjectDetail: Tasks fetched:', data.length, 'tasks');
      return data;
    },
    enabled: !!id,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache
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
    gcTime: 0, // Don't cache
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
    gcTime: 0, // Don't cache
  });

  // Listen for task creation events to refresh data - moved after queries are defined
  useEffect(() => {
    const handleTaskCreated = (event: CustomEvent) => {
      console.log('📨 ProjectDetail: Received taskCreated event:', event.detail);
      if (event.detail?.projectId === parseInt(id!)) {
        console.log('🔄 ProjectDetail: Refreshing data for project:', id);
        setRefreshKey(prev => prev + 1);
        // Also manually refetch tasks
        refetchTasks();
        refetchTasksWithControls();
      }
    };
    
    window.addEventListener('taskCreated', handleTaskCreated as EventListener);
    return () => {
      window.removeEventListener('taskCreated', handleTaskCreated as EventListener);
    };
  }, [id, refetchTasks, refetchTasksWithControls]);

  // Task creation is now handled by TaskWizard component

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const taskData = {
        ...data,
        projectId: parseInt(id!),
        // Use the assigneeEmail as assigneeId for now
        assigneeId: data.assigneeEmail,
        // Map controlId to controlId for database compatibility
        controlId: data.controlId,
      };
      return await apiRequest('/api/tasks', 'POST', taskData);
    },
    onSuccess: () => {
      // Invalidate all task-related queries to ensure immediate visibility
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/tasks');
        }
      });
      
      // Force refresh of project detail data
      setRefreshKey(prev => prev + 1);
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
        // Map controlId to controlId for database compatibility
        controlId: data.controlId,
      };
      console.log('🔄 Final task data being sent to API:', taskData);
      console.log('🔄 Making PUT request to:', `/api/tasks/${data.id}`);
      const result = await apiRequest(`/api/tasks/${data.id}`, 'PUT', taskData);
      console.log('🔄 API response received:', result);
      return result;
    },
    onSuccess: async (data, variables) => {
      console.log('✅ updateTaskMutation.onSuccess called with:', { data, variables });
      
      // Invalidate all task-related queries to ensure immediate visibility
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/tasks');
        }
      });
      
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

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest(`/api/tasks/${taskId}`, 'DELETE');
    },
    onSuccess: () => {
      // Invalidate all task-related queries to ensure immediate visibility
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/tasks');
        }
      });
      
      setRefreshKey(prev => prev + 1);
      toast({
        title: language === 'ar' ? 'تم حذف المهمة' : 'Task Deleted',
        description: language === 'ar' ? 'تم حذف المهمة بنجاح' : 'Task deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حذف المهمة' : 'Failed to delete task',
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
    (control: any) => control.control?.id === selectedControlId
  )?.control;

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

  // Filter tasks based on search and filters
  const filteredTasks = tasksWithControls?.filter((task: any) => {
    const matchesSearch = !taskSearchTerm || 
      task.title.toLowerCase().includes(taskSearchTerm.toLowerCase()) ||
      (task.titleAr && task.titleAr.toLowerCase().includes(taskSearchTerm.toLowerCase())) ||
      (task.description && task.description.toLowerCase().includes(taskSearchTerm.toLowerCase())) ||
      (task.descriptionAr && task.descriptionAr.toLowerCase().includes(taskSearchTerm.toLowerCase()));
    
    const matchesStatus = taskStatusFilter === 'all' || task.status === taskStatusFilter;
    const matchesPriority = taskPriorityFilter === 'all' || task.priority === taskPriorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  // Find project owner
  const projectOwner = users?.find((user: any) => user.id === project?.ownerId);

  // Group controls by domain
  const groupedControls = projectControls?.reduce((acc: any, control: any) => {
    const domain = language === 'ar'
      ? (control.control?.mainCategoryAr || control.control?.domainAr)
      : (control.control?.mainCategoryEn || control.control?.domainEn);
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
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {language === 'ar' ? 'تصدير التقرير' : 'Export Report'}
            </Button>
            <Button onClick={() => handleCreateTask()} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'مهمة جديدة' : 'New Task'}
            </Button>
          </div>
        </div>

        {/* Project Information Card */}
        <Card className="bg-gradient-to-r from-[#2699A6]/5 to-transparent border-l-4 border-l-[#2699A6]">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Project Status & Priority */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {language === 'ar' ? 'أولوية المشروع' : 'Project Priority'}
                </h3>
                <div className="space-y-2">
                  <Badge 
                    className={`${
                      project.priority === 'urgent' ? 'bg-red-500 text-white' :
                      project.priority === 'high' ? 'bg-orange-500 text-white' :
                      project.priority === 'medium' ? 'bg-yellow-500 text-white' :
                      'bg-gray-500 text-white'
                    } font-semibold px-3 py-1`}
                  >
                    {project.priority === 'low' ? (language === 'ar' ? 'منخفضة' : 'Low') :
                     project.priority === 'medium' ? (language === 'ar' ? 'متوسطة' : 'Medium') :
                     project.priority === 'high' ? (language === 'ar' ? 'عالية' : 'High') :
                     (language === 'ar' ? 'عاجلة' : 'Urgent')} Priority
                  </Badge>
                </div>
              </div>

              {/* Project Owner */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {language === 'ar' ? 'مالك المشروع' : 'Project Owner'}
                </h3>
                {projectOwner ? (
                  <div className="flex items-center space-x-3">
                    <UserAvatar user={projectOwner} size="lg" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {projectOwner.firstName} {projectOwner.lastName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {projectOwner.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    {language === 'ar' ? 'غير محدد' : 'Not assigned'}
                  </p>
                )}
              </div>

              {/* Project Dates */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {language === 'ar' ? 'التواريخ' : 'Timeline'}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-[#2699A6]" />
                    <span className="text-gray-600 dark:text-gray-400 mr-2">
                      {language === 'ar' ? 'البداية:' : 'Start:'}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-[#2699A6]" />
                    <span className="text-gray-600 dark:text-gray-400 mr-2">
                      {language === 'ar' ? 'النهاية:' : 'End:'}
                    </span>
                    <span className={`font-medium ${
                      project.endDate && new Date(project.endDate) < new Date() 
                        ? 'text-red-600' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {language === 'ar' ? 'ملخص التقدم' : 'Progress Summary'}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'ar' ? 'اكتمال المهام' : 'Task Completion'}
                    </span>
                    <span className="text-lg font-bold text-[#2699A6]">
                      {completionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div 
                      className="bg-gradient-to-r from-[#2699A6] to-[#34d399] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{completedTasks} {language === 'ar' ? 'مكتملة' : 'completed'}</span>
                    <span>{totalTasks} {language === 'ar' ? 'إجمالي' : 'total'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">
              {language === 'ar' ? 'المهام' : 'Tasks'}
            </TabsTrigger>
            <TabsTrigger value="controls">
              {language === 'ar' ? 'الضوابط' : 'Controls'}
            </TabsTrigger>
            <TabsTrigger value="comments">
              {language === 'ar' ? 'التعليقات' : 'Comments'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {/* Task Search and Filters */}
            {totalTasks > 0 && (
              <Card className="glass-card">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                      <Input
                        type="search"
                        placeholder={language === 'ar' ? 'البحث في المهام...' : 'Search tasks...'}
                        value={taskSearchTerm}
                        onChange={(e) => setTaskSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[160px]">
                          <SelectValue placeholder={language === 'ar' ? 'الحالة' : 'Status'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'ar' ? 'جميع الحالات' : 'All Status'}</SelectItem>
                          <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'Not Started'}</SelectItem>
                          <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                          <SelectItem value="review">{language === 'ar' ? 'قيد المراجعة' : 'Under Review'}</SelectItem>
                          <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                          <SelectItem value="blocked">{language === 'ar' ? 'محجوبة' : 'Blocked'}</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
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
                  
                  {/* Filter Results Info */}
                  {(taskSearchTerm || taskStatusFilter !== 'all' || taskPriorityFilter !== 'all') && (
                    <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                      {language === 'ar' 
                        ? `عرض ${filteredTasks.length} من ${totalTasks} مهمة`
                        : `Showing ${filteredTasks.length} of ${totalTasks} tasks`
                      }
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
            ) : filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Activity className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {language === 'ar' ? 'لم يتم العثور على مهام' : 'No tasks found'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {language === 'ar' ? 'جرب تغيير مرشحات البحث أو الحالة أو الأولوية' : 'Try adjusting your search, status, or priority filters'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredTasks?.map((task: any) => {
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
                          {/* Header with title */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
                                {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                              </h3>
                            </div>
                          </div>
                          
                          {/* Controls as badges */}
                          {task.controls && task.controls.length > 0 && (
                            <TooltipProvider>
                              <div className="flex flex-wrap gap-2">
                                {task.controls.map((control: any) => {
                                  // Get the actual control data (ECC or custom)
                                  const actualControl = control.eccControl || control.customControl;
                                  if (!actualControl) return null;
                                  
                                  return (
                                    <Tooltip key={actualControl.id}>
                                      <TooltipTrigger asChild>
                                        <div className="inline-block">
                                          <Badge 
                                            variant="outline" 
                                            className="text-xs font-medium bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300 cursor-help"
                                          >
                                            {actualControl.code}
                                          </Badge>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-sm p-3">
                                        <div className="space-y-2">
                                          <div className="font-semibold text-sm">
                                            {actualControl.code} - {language === 'ar' ? (actualControl.domainAr || actualControl.mainDomainAr || actualControl.mainDomain) : (actualControl.domainEn || actualControl.mainDomain)}
                                          </div>
                                          <div className="text-xs text-gray-600 leading-relaxed">
                                            {language === 'ar' ? (actualControl.subdomainAr || actualControl.subDomainAr) : (actualControl.subdomainEn || actualControl.subDomain)}
                                          </div>
                                          <div className="text-xs text-gray-700 leading-relaxed border-t pt-2">
                                            {language === 'ar' ? (actualControl.controlAr || actualControl.control) : (actualControl.controlEn || actualControl.control)}
                                          </div>
                                          {(actualControl.evidenceEn || actualControl.evidenceAr) && (
                                            <div className="pt-1 border-t">
                                              <div className="text-xs font-medium text-blue-600">
                                                {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                                              </div>
                                              <div className="text-xs text-gray-600 mt-1 max-h-20 overflow-y-auto">
                                                {language === 'ar' ? actualControl.evidenceAr : actualControl.evidenceEn}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  );
                                })}
                              </div>
                            </TooltipProvider>
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
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                                <UserAvatar user={assignedUser} size="sm" className="w-4 h-4" />
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
            {/* Domain filter notice */}
            {domainFromUrl && (
              <Card className="bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                      <span className="text-sm font-medium text-teal-800 dark:text-teal-200">
                        {language === 'ar' ? `عرض ضوابط نطاق: ${domainFromUrl}` : `Showing controls for domain: ${domainFromUrl}`}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Clear domain parameter from URL
                        const newUrl = window.location.pathname;
                        window.history.replaceState({}, '', newUrl);
                        window.location.reload();
                      }}
                      className="text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-600 hover:bg-teal-100 dark:hover:bg-teal-800"
                    >
                      {language === 'ar' ? 'عرض جميع النطاقات' : 'Show All Domains'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {Object.entries(groupedControls)
              .filter(([domain]) => !domainFromUrl || domain === domainFromUrl)
              .map(([domain, controls]) => (
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
                    const controlTasks = tasks?.filter((task: any) => task.controlId === control.control?.id) || [];
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
                                {(control.eccControl || control.customControl)?.code}
                              </Badge>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 leading-tight">
                                {language === 'ar' && (control.control?.subCategoryAr || control.control?.subdomainAr)
                                  ? (control.control?.subCategoryAr || control.control?.subdomainAr)
                                  : (control.control?.subCategoryEn || control.control?.subdomainEn || control.control?.titleEn || control.control?.titleAr || 'No title available')}
                              </h3>
                              
                              {/* Control Description */}
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">
                                {language === 'ar' && (control.control?.mainControlAr || control.control?.controlAr)
                                  ? (control.control?.mainControlAr || control.control?.controlAr)
                                  : (control.control?.mainControlEn || control.control?.controlEn || 'No description available')}
                              </p>
                              
                              {/* Implementation Guidance */}
                              {(control.control?.descriptionEn || control.control?.descriptionAr || control.control?.implementationGuidanceEn || control.control?.implementationGuidanceAr) && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                  {language === 'ar' && (control.control?.descriptionAr || control.control?.implementationGuidanceAr)
                                    ? (control.control?.descriptionAr || control.control?.implementationGuidanceAr)
                                    : (control.control?.descriptionEn || control.control?.implementationGuidanceEn)}
                                </p>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-medium">
                                  {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'}
                                </span>
                                <span className="ml-1">
                                  {control.control?.evidenceTypes && control.control?.evidenceTypes?.length > 0
                                    ? control.control?.evidenceTypes.join(', ')
                                    : (language === 'ar'
                                        ? (control.control?.evidenceAr || control.control?.evidenceRequiredAr || 'وثائق ، سياسات ، إجراءات ، وأدلة تدقيق')
                                        : (control.control?.evidenceEn || control.control?.evidenceRequiredEn || 'Documentation, policies, procedures, and audit evidence'))}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <Badge variant="outline" className="text-xs">
                              {(tasksWithControls?.filter((task: any) => 
                                task.controls?.some((taskControl: any) => {
                                  const taskCtrlId = (taskControl.eccControl || taskControl.customControl)?.id;
                                  const ctrlId = (control.control || control.eccControl || control.customControl)?.id;
                                  return taskCtrlId === ctrlId;
                                })
                              ) || []).length} {language === 'ar' ? 'مهمة' : 'Tasks'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCreateTask(control.control?.id)}
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

          <TabsContent value="comments" className="space-y-4">
            <Comments targetType="project" targetId={project?.id || 0} />
          </TabsContent>
        </Tabs>

        {/* Task Creation Wizard */}
        <TaskWizard
          isOpen={isTaskWizardOpen}
          onClose={() => setIsTaskWizardOpen(false)}
          preselectedProjectId={parseInt(id!)}
          onTaskCreated={() => {
            console.log('🔄 ProjectDetail: Direct task created callback triggered');
            setRefreshKey(prev => prev + 1);
            refetchTasks();
            refetchTasksWithControls();
          }}
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
                onDelete={async (taskId: number) => {
                  await deleteTaskMutation.mutateAsync(taskId);
                  setIsTaskEditDialogOpen(false);
                  setEditingTask(null);
                }}
                isLoading={updateTaskMutation.isPending}
                language={language}
              />
            )}
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

        {/* Export Dialog */}
        <ExportComplianceDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          projectId={parseInt(id)}
          projectName={project.name}
          regulationCode="ecc"
        />
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
  onDelete,
  isLoading, 
  language 
}: {
  task: any;
  projectControls: any[];
  taskEvidence: any[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  onDelete?: (taskId: number) => Promise<void>;
  isLoading: boolean;
  language: string;
}) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'controls' | 'evidence' | 'workflow'>('details');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [uploadComment, setUploadComment] = useState('');
  const [selectedControlForView, setSelectedControlForView] = useState<number | null>(null);
  const [showEvidenceForControl, setShowEvidenceForControl] = useState<boolean>(false);
  const [evidenceAttachMode, setEvidenceAttachMode] = useState<'upload' | 'link' | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [hasAutoSelectedControl, setHasAutoSelectedControl] = useState(false);
  const [selectedControlForInfo, setSelectedControlForInfo] = useState<any>(null);
  const [isControlInfoDialogOpen, setIsControlInfoDialogOpen] = useState(false);
  const [pendingRemovedControls, setPendingRemovedControls] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Workflow state
  const [routeDraft, setRouteDraft] = useState<Array<{ userId:string; role:string }>>([]);
  const [returnOpen, setReturnOpen] = useState(false);
  
  const [editedTask, setEditedTask] = useState({
    title: task.title || '',
    titleAr: task.titleAr || '',
    description: task.description || '',
    descriptionAr: task.descriptionAr || '',
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    assigneeId: task.assigneeId || null,
    dueDate: task.dueDate || null,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { user } = useAuth();
  const taskId = task.id;

  // Fetch task controls
  const { data: taskControls } = useQuery({
    queryKey: ['/api/tasks', task.id, 'controls'],
    enabled: !!task.id,
  });

  // Fetch all users for assignee dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });
  
  console.log('🔍 Users loaded for ProjectDetail:', users.length, users);

  // Fetch evidence versions and comments for each evidence
  const { data: evidenceVersions } = useQuery({
    queryKey: ['/api/evidence', 'versions', task.id],
    enabled: !!task.id,
  });

  const { data: evidenceComments } = useQuery({
    queryKey: ['/api/evidence', 'comments', task.id],
    enabled: !!task.id,
  });

  // Get filtered task controls (excluding pending removed)
  const filteredTaskControls = (taskControls || []).filter(
    (control: any) => {
      const controlData = control.control || control.eccControl || control.customControl;
      return controlData && !pendingRemovedControls.includes(controlData.id);
    }
  );

  // Auto-select first control when Evidence tab is accessed
  useEffect(() => {
    if (activeTab === 'evidence' && filteredTaskControls && filteredTaskControls.length > 0 && !hasAutoSelectedControl) {
      const firstControl = filteredTaskControls[0];
      const controlData = firstControl?.control || firstControl?.eccControl || firstControl?.customControl;
      if (controlData?.id) {
        setSelectedControlId(controlData.id);
        setSelectedControlForView(controlData.id);
        setHasAutoSelectedControl(true);
      }
    }
    // Reset auto-selection flag when leaving Evidence tab
    if (activeTab !== 'evidence') {
      setHasAutoSelectedControl(false);
    }
  }, [activeTab, filteredTaskControls, hasAutoSelectedControl]);

  // Fetch evidence linked to specific control
  const { data: controlLinkedEvidence } = useQuery({
    queryKey: ['/api/evidence', 'control', selectedControlForView],
    enabled: !!selectedControlForView,
  });

  // Fetch all evidence for linking
  const { data: allEvidence = [] } = useQuery({
    queryKey: ['/api/evidence'],
  });

  // Workflow queries and mutations
  const { data: wfData, isLoading: wfLoading } = useQuery({
    queryKey: ["workflow", taskId],
    queryFn: () => getWorkflow(taskId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (wfData?.route?.length) {
      setRouteDraft(wfData.route.sort((a,b)=>a.stepIndex-b.stepIndex).map(r=>({ userId: r.userId, role: r.role })));
    } else {
      setRouteDraft([]);
    }
  }, [wfData]);

  const mSetRoute = useMutation({
    mutationFn: (steps: {userId:string; role:string}[]) => setRoute(taskId, steps),
    onSuccess: () => { toast({ title: "Review route saved" }); queryClient.invalidateQueries({ queryKey: ["workflow", taskId] }); },
    onError: (e:any) => toast({ title: "Failed to save route", description: e.message, variant: "destructive" }),
  });

  const mSubmit = useMutation({
    mutationFn: () => submitStep(taskId),
    onSuccess: () => { toast({ title: "Submitted to next reviewer" }); queryClient.invalidateQueries({ queryKey: ["workflow", taskId] }); },
    onError: (e:any) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
  });

  const mReturn = useMutation({
    mutationFn: (p:{toUserId:string; comment:string}) => returnTo(taskId, p.toUserId, p.comment),
    onSuccess: () => { setReturnOpen(false); toast({ title: "Task returned" }); queryClient.invalidateQueries({ queryKey: ["workflow", taskId] }); },
    onError: (e:any) => toast({ title: "Return failed", description: e.message, variant: "destructive" }),
  });

  const mApprove = useMutation({
    mutationFn: () => approve(taskId),
    onSuccess: () => { toast({ title: "Approved" }); queryClient.invalidateQueries({ queryKey: ["workflow", taskId] }); queryClient.invalidateQueries({ queryKey: ["task", taskId] }); },
    onError: (e:any) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });

  const mReject = useMutation({
    mutationFn: (p:{toUserId:string; comment:string}) => reject(taskId, p.toUserId, p.comment),
    onSuccess: () => { setReturnOpen(false); toast({ title: "Rejected and returned" }); queryClient.invalidateQueries({ queryKey: ["workflow", taskId] }); },
    onError: (e:any) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  const currentAssigneeId = wfData?.workflow?.currentAssigneeId || null;
  const currentState = wfData?.workflow?.state || "draft";
  const candidates = (wfData?.route || []).map(r => {
    const user = Array.isArray(users) ? users.find((u: any) => u.id === r.userId) : undefined;
    return { 
      userId: r.userId, 
      name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email : r.userId
    };
  });

  // Mutation for adding evidence comments
  const addCommentMutation = useMutation({
    mutationFn: async ({ evidenceId, comment }: { evidenceId: number; comment: string }) => {
      return apiRequest(`/api/evidence/${evidenceId}/comments`, 'POST', { comment });
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

  // Mutation for adding controls to task
  const addControlsToTaskMutation = useMutation({
    mutationFn: async (controlIds: number[]) => {
      return apiRequest(`/api/tasks/${task.id}/controls`, 'POST', { controlIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task.id, 'controls'] });
      toast({
        title: language === 'ar' ? 'تم إضافة الضوابط' : 'Controls Added',
        description: language === 'ar' ? 'تم إضافة الضوابط بنجاح' : 'Controls added successfully',
      });
    },
  });

  // Mutation for removing control from task
  const removeControlFromTaskMutation = useMutation({
    mutationFn: async (controlId: number) => {
      return apiRequest(`/api/tasks/${task.id}/controls`, 'DELETE', { controlIds: [controlId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', task.id, 'controls'] });
      toast({
        title: language === 'ar' ? 'تم حذف الضابط' : 'Control Removed',
        description: language === 'ar' ? 'تم حذف الضابط بنجاح' : 'Control removed successfully',
      });
    },
  });

  // Mutation for linking evidence to task
  const linkEvidenceToTaskMutation = useMutation({
    mutationFn: async ({ evidenceId, taskId }: { evidenceId: number; taskId: number }) => {
      return apiRequest(`/api/evidence/${evidenceId}/tasks`, 'POST', { taskIds: [taskId] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      toast({
        title: language === 'ar' ? 'تم ربط الدليل' : 'Evidence Linked',
        description: language === 'ar' ? 'تم ربط الدليل بالمهمة بنجاح' : 'Evidence linked to task successfully',
      });
    },
  });

  const handleAddComment = (evidenceId: number, comment: string) => {
    if (comment.trim()) {
      addCommentMutation.mutate({ evidenceId, comment: comment.trim() });
    }
  };

  const handleControlClick = (control: any) => {
    setSelectedControlForInfo(control);
    setIsControlInfoDialogOpen(true);
  };

  // Get unique domains from project controls
  const domains = Array.from(new Set(
    projectControls.map((pc: any) => pc.control?.domainEn).filter(Boolean)
  ));

  // Get controls for selected domain that are NOT already assigned to the task
  const domainControls = selectedDomain 
    ? projectControls.filter((pc: any) => {
        const isInDomain = pc.control?.domainEn === selectedDomain;
        const isAlreadyAssigned = (taskControls || []).some((tc: any) => {
          const tcId = (tc.eccControl || tc.customControl || tc.control)?.id;
          const pcId = (pc.control || pc.eccControl || pc.customControl)?.id;
          return tcId === pcId;
        });
        return isInDomain && !isAlreadyAssigned;
      })
    : [];

  // Handle task form submission
  const handleTaskSubmit = async () => {
    try {
      // First update the task details
      await onSubmit(editedTask);
      
      // Then handle control removals if any
      if (pendingRemovedControls.length > 0) {
        await removeControlFromTaskMutation.mutateAsync(pendingRemovedControls[0]);
        // Remove all pending controls sequentially
        for (const controlId of pendingRemovedControls.slice(1)) {
          await removeControlFromTaskMutation.mutateAsync(controlId);
        }
        setPendingRemovedControls([]); // Clear pending removals after successful save
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  // Handle adding selected controls to task
  const handleAddControlsToTask = (controlIds: number[]) => {
    if (controlIds.length > 0) {
      addControlsToTaskMutation.mutate(controlIds);
      setSelectedDomain(''); // Reset domain selection
    }
  };

  // Handle temporary control removal
  const handleTemporaryRemoveControl = (controlId: number) => {
    console.log('Removing control with ID:', controlId);
    console.log('Current taskControls:', taskControls);
    setPendingRemovedControls(prev => {
      const updated = [...prev, controlId];
      console.log('Updated pendingRemovedControls:', updated);
      return updated;
    });
  };

  // Handle restoring temporarily removed control
  const handleRestoreControl = (controlId: number) => {
    setPendingRemovedControls(prev => prev.filter(id => id !== controlId));
  };

  // Handle task deletion
  const handleDeleteTask = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(task.id);
      toast({
        title: language === 'ar' ? 'تم حذف المهمة' : 'Task Deleted',
        description: language === 'ar' ? 'تم حذف المهمة بنجاح' : 'Task deleted successfully',
      });
      onCancel(); // Close the dialog
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حذف المهمة' : 'Failed to delete task',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
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
      if (uploadComment.trim()) {
        formData.append('comment', uploadComment.trim());
      }

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setUploadedFiles([]);
      setUploadComment('');
      setEvidenceAttachMode(null); // Reset attach mode
      // Invalidate evidence queries to refresh the display
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', 'versions', task.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/evidence', 'comments', task.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/evidence/control', selectedControlId] });
      // Show success toast
      toast({
        title: language === 'ar' ? 'تم رفع وربط الملفات بنجاح' : 'Files Uploaded & Linked Successfully',
        description: language === 'ar' ? 'تم رفع الأدلة وربطها بالضابط بنجاح' : 'Evidence files uploaded and linked to control successfully',
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

  // Handle linking existing evidence to the selected control
  const handleLinkExistingEvidence = async (evidenceId: number) => {
    if (!selectedControlId) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب اختيار ضابط أولاً' : 'Please select a control first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiRequest(`/api/evidence/${evidenceId}/controls`, 'POST', { 
        controlIds: [selectedControlId] 
      });

      // Refresh the control linked evidence
      queryClient.invalidateQueries({ queryKey: ['/api/evidence/control', selectedControlId] });
      
      toast({
        title: language === 'ar' ? 'تم الربط بنجاح' : 'Linked Successfully',
        description: language === 'ar' ? 'تم ربط الدليل بالضابط بنجاح' : 'Evidence linked to control successfully',
      });

      // Reset the attach mode
      setEvidenceAttachMode(null);
    } catch (error) {
      console.error('Error linking evidence:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الربط' : 'Link Error',
        description: language === 'ar' ? 'فشل في ربط الدليل' : 'Failed to link evidence',
        variant: 'destructive',
      });
    }
  };

  // Handle evidence file download
  const handleDownloadEvidence = async (evidenceId: number, fileName: string) => {
    try {
      const response = await fetch(`/api/evidence/${evidenceId}/download`, {
        method: 'GET',
        credentials: 'include', // Include session cookies for authentication
      });

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      // Create blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: language === 'ar' ? 'نجح' : 'Success',
        description: language === 'ar' ? 'تم تحميل الملف بنجاح' : 'File downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading evidence:', error);
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في تحميل الملف' : 'Failed to download file'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      

      {/* Three-Tab Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'controls' | 'evidence' | 'workflow')}>
        <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <TabsTrigger 
            value="details"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white font-medium transition-all duration-200"
          >
            {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
          </TabsTrigger>
          <TabsTrigger 
            value="controls"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white font-medium transition-all duration-200"
          >
            {language === 'ar' ? 'الضوابط' : 'Controls'}
          </TabsTrigger>
          <TabsTrigger 
            value="evidence"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white font-medium transition-all duration-200"
          >
            {language === 'ar' ? 'الأدلة' : 'Evidence'}
          </TabsTrigger>
          <TabsTrigger 
            value="workflow"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white font-medium transition-all duration-200"
          >
            {language === 'ar' ? 'سير العمل' : 'Workflow'}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Task Details */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'العنوان (إنجليزي)' : 'Title (English)'}
              </label>
              <Input
                value={editedTask.title}
                onChange={(e) => setEditedTask(prev => ({ ...prev, title: e.target.value }))}
                placeholder={language === 'ar' ? 'أدخل العنوان بالإنجليزي' : 'Enter title in English'}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'العنوان (عربي)' : 'Title (Arabic)'}
              </label>
              <Input
                value={editedTask.titleAr}
                onChange={(e) => setEditedTask(prev => ({ ...prev, titleAr: e.target.value }))}
                placeholder={language === 'ar' ? 'أدخل العنوان بالعربي' : 'Enter title in Arabic'}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}
              </label>
              <Textarea
                value={editedTask.description}
                onChange={(e) => setEditedTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder={language === 'ar' ? 'أدخل الوصف بالإنجليزي' : 'Enter description in English'}
                rows={3}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}
              </label>
              <Textarea
                value={editedTask.descriptionAr}
                onChange={(e) => setEditedTask(prev => ({ ...prev, descriptionAr: e.target.value }))}
                placeholder={language === 'ar' ? 'أدخل الوصف بالعربي' : 'Enter description in Arabic'}
                rows={3}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الحالة' : 'Status'}
              </label>
              <Select value={editedTask.status} onValueChange={(value) => setEditedTask(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{language === 'ar' ? 'قيد الانتظار' : 'Pending'}</SelectItem>
                  <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                  <SelectItem value="review">{language === 'ar' ? 'قيد المراجعة' : 'Review'}</SelectItem>
                  <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                  <SelectItem value="blocked">{language === 'ar' ? 'محجوبة' : 'Blocked'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'الأولوية' : 'Priority'}
              </label>
              <Select value={editedTask.priority} onValueChange={(value) => setEditedTask(prev => ({ ...prev, priority: value }))}>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
              </label>
              <Input
                type="date"
                value={editedTask.dueDate || ''}
                onChange={(e) => setEditedTask(prev => ({ ...prev, dueDate: e.target.value || null }))}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'ar' ? 'المسؤول المعين' : 'Assigned Person'}
            </label>
            <Select value={editedTask.assigneeId || 'unassigned'} onValueChange={(value) => setEditedTask(prev => ({ ...prev, assigneeId: value === 'unassigned' ? null : value }))}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر المسؤول...' : 'Select assignee...'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{language === 'ar' ? 'غير محدد' : 'Unassigned'}</SelectItem>
                {users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        {/* Tab 2: Controls */}
        <TabsContent value="controls" className="space-y-4">
          {/* Current Controls */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {language === 'ar' ? 'الضوابط المرتبطة حالياً' : 'Currently Assigned Controls'}
            </h3>
            <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
              {filteredTaskControls && filteredTaskControls.length > 0 ? (
                <div className="space-y-3">
                  {filteredTaskControls.map((control: any) => (
                    <div key={control.id} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg">
                      <Badge 
                        variant="secondary" 
                        className="mt-1"
                      >
                        {(control.control || control.eccControl || control.customControl)?.code}
                      </Badge>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {(() => {
                            const controlData = control.control || control.eccControl || control.customControl;
                            return language === 'ar' && (controlData?.subdomainAr || controlData?.subDomainAr)
                              ? (controlData.subdomainAr || controlData.subDomainAr)
                              : (controlData?.subdomainEn || controlData?.subDomain);
                          })()}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {(() => {
                            const controlData = control.control || control.eccControl || control.customControl;
                            return language === 'ar' && (controlData?.controlAr || controlData?.control)
                              ? (controlData.controlAr || controlData.control)
                              : (controlData?.controlEn || controlData?.control);
                          })()}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          const controlId = control.control?.id || control.eccControl?.id || control.controlId;
                          if (controlId) handleTemporaryRemoveControl(controlId);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        {language === 'ar' ? 'حذف' : 'Remove'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  {language === 'ar' ? 'لا توجد ضوابط مرتبطة' : 'No controls assigned'}
                </p>
              )}
            </div>
          </div>

          {/* Pending Removed Controls */}
          {pendingRemovedControls.length > 0 && (
            <div>
              <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3">
                {language === 'ar' ? 'الضوابط المحذوفة مؤقتاً (سيتم حفظ التغييرات عند الحفظ)' : 'Pending Removed Controls (will be saved on Save)'}
              </h3>
              <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20">
                <div className="space-y-3">
                  {pendingRemovedControls.map((controlId) => {
                    console.log('Looking for control with ID:', controlId);
                    const control = taskControls?.find((tc: any) => {
                      const tcControlId = tc.control?.id || tc.eccControl?.id || tc.controlId;
                      console.log('Checking control:', tc, 'extracted ID:', tcControlId);
                      return tcControlId === controlId;
                    });
                    console.log('Found control for pending removal:', control);
                    if (!control) return null;
                    
                    return (
                      <div key={control.id} className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border border-red-200">
                        <Badge variant="secondary" className="mt-1 opacity-50">
                          {(control.control || control.eccControl || control.customControl)?.code}
                        </Badge>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1 opacity-50">
                            {(() => {
                              const controlData = control.control || control.eccControl || control.customControl;
                              return language === 'ar' && (controlData?.subdomainAr || controlData?.subDomainAr)
                                ? (controlData.subdomainAr || controlData.subDomainAr)
                                : (controlData?.subdomainEn || controlData?.subDomain);
                            })()}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 opacity-50">
                            {(() => {
                              const controlData = control.control || control.eccControl || control.customControl;
                              return language === 'ar' && (controlData?.controlAr || controlData?.control)
                                ? (controlData.controlAr || controlData.control)
                                : (controlData?.controlEn || controlData?.control);
                            })()}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleRestoreControl(control.control?.id)}
                          className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400"
                        >
                          {language === 'ar' ? 'استعادة' : 'Restore'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Add New Controls */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {language === 'ar' ? 'إضافة ضوابط جديدة' : 'Add New Controls'}
            </h3>
            
            {!selectedDomain ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'ar' ? 'اختر النطاق' : 'Select Domain'}
                </label>
                <div className="grid gap-3">
                  {domains.map((domain) => (
                    <div 
                      key={domain}
                      className="p-3 border rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      onClick={() => setSelectedDomain(domain)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{domain}</span>
                        <Badge variant="secondary">
                          {projectControls.filter(pc => {
                            const pcDomain = (pc.control || pc.eccControl || pc.customControl)?.domainEn || (pc.control || pc.eccControl || pc.customControl)?.mainDomain;
                            const isInDomain = pcDomain === domain;
                            const isAssigned = taskControls?.some(tc => {
                              const tcId = (tc.eccControl || tc.customControl || tc.control)?.id;
                              const pcId = (pc.control || pc.eccControl || pc.customControl)?.id;
                              return tcId === pcId;
                            });
                            return isInDomain && !isAssigned;
                          }).length} available
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">{selectedDomain}</h4>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedDomain('')}
                  >
                    {language === 'ar' ? 'العودة للنطاقات' : 'Back to Domains'}
                  </Button>
                </div>
                
                {domainControls.length > 0 ? (
                  <ControlSelector 
                    controls={domainControls}
                    onAddControls={handleAddControlsToTask}
                    language={language}
                    isLoading={addControlsToTaskMutation.isPending}
                    onControlClick={handleControlClick}
                  />
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {language === 'ar' ? 'جميع الضوابط في هذا النطاق مرتبطة بالفعل' : 'All controls in this domain are already assigned'}
                  </p>
                )}
              </div>
            )}
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
              <Select 
                value={selectedControlId?.toString() || ''}
                onValueChange={(value) => {
                  const controlId = parseInt(value);
                  setSelectedControlId(controlId);
                  setSelectedControlForView(controlId);
                  setShowEvidenceForControl(false); // Reset evidence display when selecting new control
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر ضابط...' : 'Select a control...'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredTaskControls?.map((control: any) => (
                    <SelectItem key={control.id} value={(control.control || control.eccControl || control.customControl)?.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">
                          {(control.control || control.eccControl || control.customControl)?.code}
                        </span>
                        <span className="text-sm">
                          {(() => {
                            const controlData = control.control || control.eccControl || control.customControl;
                            return language === 'ar' && (controlData?.subdomainAr || controlData?.subDomainAr)
                              ? (controlData.subdomainAr || controlData.subDomainAr)
                              : (controlData?.subdomainEn || controlData?.subDomain);
                          })()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Control Information Display */}
            {selectedControlId && taskControls?.find((c: any) => (c.control || c.eccControl || c.customControl)?.id === selectedControlId) && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3 mb-3">
                  <Badge variant="secondary" className="mt-1">
                    {(() => {
                      const foundControl = taskControls.find((c: any) => (c.control || c.eccControl || c.customControl)?.id === selectedControlId);
                      const controlData = foundControl?.control || foundControl?.eccControl || foundControl?.customControl;
                      return controlData?.code;
                    })()}
                  </Badge>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                      {(() => {
                        const foundControl = taskControls.find((c: any) => (c.control || c.eccControl || c.customControl)?.id === selectedControlId);
                        const controlData = foundControl?.control || foundControl?.eccControl || foundControl?.customControl;
                        return language === 'ar' && (controlData?.subdomainAr || controlData?.subDomainAr)
                          ? (controlData.subdomainAr || controlData.subDomainAr)
                          : (controlData?.subdomainEn || controlData?.subDomain);
                      })()}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {(() => {
                        const foundControl = taskControls.find((c: any) => (c.control || c.eccControl || c.customControl)?.id === selectedControlId);
                        const controlData = foundControl?.control || foundControl?.eccControl || foundControl?.customControl;
                        return language === 'ar' && (controlData?.controlAr || controlData?.control)
                          ? (controlData.controlAr || controlData.control)
                          : (controlData?.controlEn || controlData?.control);
                      })()}
                    </p>
                    
                    {/* Required Evidence */}
                    <div className="mb-3">
                      <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {(() => {
                          const foundControl = taskControls.find((c: any) => (c.control || c.eccControl || c.customControl)?.id === selectedControlId);
                          const controlData = foundControl?.control || foundControl?.eccControl || foundControl?.customControl;
                          return language === 'ar' 
                            ? (controlData?.evidenceAr || 'وثائق، سياسات، إجراءات، وأدلة تدقيق')
                            : (controlData?.evidenceEn || 'Documentation, policies, procedures, and audit evidence');
                        })()}
                      </p>
                    </div>

                    {/* Evidence Link Status - Clickable */}
                    <div className="flex items-center gap-2">
                      {controlLinkedEvidence && controlLinkedEvidence.length > 0 ? (
                        <div 
                          className="flex items-center gap-1 text-green-600 dark:text-green-400 cursor-pointer hover:text-green-700 dark:hover:text-green-300 transition-colors"
                          onClick={() => setShowEvidenceForControl(!showEvidenceForControl)}
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs font-medium underline">
                            {language === 'ar' 
                              ? `مرتبط بـ ${controlLinkedEvidence.length} دليل - اضغط للعرض` 
                              : `${controlLinkedEvidence.length} evidence linked - click to view`}
                          </span>
                          <ChevronDown className={`h-3 w-3 transition-transform ${showEvidenceForControl ? 'rotate-180' : ''}`} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                          <span className="text-xs font-medium">
                            {language === 'ar' ? 'لا توجد أدلة مرتبطة' : 'No evidence linked'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Evidence Display Section - Shows when evidence status is clicked */}
                {showEvidenceForControl && (
                  <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      {language === 'ar' ? 'الأدلة المرتبطة' : 'Linked Evidence'}
                    </h4>
                    
                    {/* Enhanced Evidence List with Version History and Comments */}
                    <div className="space-y-3">
                      {controlLinkedEvidence && controlLinkedEvidence.length > 0 ? (
                        controlLinkedEvidence.map((evidence: any) => (
                          <div key={evidence.id} className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-blue-500" />
                                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                                    {evidence.title}
                                  </h5>
                                  <Badge variant="secondary" className="text-xs">
                                    v{evidence.version}
                                  </Badge>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  {evidence.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                                  <span>{evidence.fileName}</span>
                                  <span>•</span>
                                  <span>{(evidence.fileSize / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span>{new Date(evidence.createdAt).toLocaleDateString()}</span>
                                </div>

                                {/* Version History */}
                                {evidence.versions && evidence.versions.length > 0 && (
                                  <div className="mb-2">
                                    <div className="flex items-center gap-1 mb-1">
                                      <History className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {language === 'ar' ? 'تاريخ الإصدارات' : 'Version History'}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      {evidence.versions.slice(0, 2).map((version: any) => (
                                        <div key={version.id} className="flex items-center gap-2 text-xs text-gray-500">
                                          <span>v{version.version}</span>
                                          <span>•</span>
                                          <span>{new Date(version.createdAt).toLocaleDateString()}</span>
                                          {version.comment && (
                                            <>
                                              <span>•</span>
                                              <span className="truncate max-w-32">{version.comment}</span>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Comments */}
                                {evidence.comments && evidence.comments.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1 mb-1">
                                      <MessageSquare className="h-3 w-3 text-gray-400" />
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {language === 'ar' ? 'التعليقات' : 'Comments'}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {evidence.comments.length}
                                      </Badge>
                                    </div>
                                    <div className="space-y-1">
                                      {evidence.comments.slice(0, 1).map((comment: any) => (
                                        <div key={comment.id} className="p-2 bg-gray-50 dark:bg-gray-600 rounded text-xs">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">
                                              {comment.user?.firstName} {comment.user?.lastName}
                                            </span>
                                            <span className="text-gray-500">
                                              {new Date(comment.createdAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p className="text-gray-600 dark:text-gray-400">{comment.comment}</p>
                                        </div>
                                      ))}
                                      {evidence.comments.length > 1 && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                          {language === 'ar' 
                                            ? `+${evidence.comments.length - 1} تعليقات أخرى` 
                                            : `+${evidence.comments.length - 1} more comments`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-xs"
                                onClick={() => handleDownloadEvidence(evidence.id, evidence.fileName)}
                                data-testid={`button-download-${evidence.id}`}
                              >
                                {language === 'ar' ? 'تحميل' : 'Download'}
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">
                            {language === 'ar' ? 'لا توجد أدلة مرتبطة بهذا الضابط' : 'No evidence linked to this control'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Unified Attach Evidence Section */}
            {selectedControlId ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {language === 'ar' ? 'إرفاق أدلة للضابط المحدد' : 'Attach Evidence to Selected Control'}
                  </h3>
                </div>

                

                {/* Toggle Options */}
                <div className="flex gap-2">
                  <Button
                    variant={evidenceAttachMode === 'upload' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEvidenceAttachMode(evidenceAttachMode === 'upload' ? null : 'upload')}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {language === 'ar' ? 'رفع ملف جديد' : 'Upload New File'}
                  </Button>
                  <Button
                    variant={evidenceAttachMode === 'link' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEvidenceAttachMode(evidenceAttachMode === 'link' ? null : 'link')}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {language === 'ar' ? 'ربط ملف موجود' : 'Link Existing File'}
                  </Button>
                </div>

                {/* Upload New File Form */}
                {evidenceAttachMode === 'upload' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {language === 'ar' ? 'اختر الملفات' : 'Choose Files'}
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt"
                          onChange={(e) => e.target.files && handleFileSelection(Array.from(e.target.files))}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {language === 'ar' ? 'تعليق (اختياري)' : 'Comment (Optional)'}
                        </label>
                        <Textarea
                          value={uploadComment}
                          onChange={(e) => setUploadComment(e.target.value)}
                          placeholder={language === 'ar' ? 'أضف تعليقاً عن هذه الأدلة...' : 'Add a comment about this evidence...'}
                          rows={3}
                          className="w-full"
                        />
                      </div>

                      {/* Selected Files List */}
                      {uploadedFiles.length > 0 && (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                            {language === 'ar' ? 'الملفات المختارة:' : 'Selected Files:'}
                          </h4>
                          <div className="space-y-2">
                            {uploadedFiles.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
                                <span className="text-sm truncate">{file.name}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFile(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={uploadEvidenceFiles}
                        disabled={uploading || uploadedFiles.length === 0}
                        className="w-full"
                      >
                        {uploading 
                          ? (language === 'ar' ? 'جاري الرفع والربط...' : 'Uploading & Linking...') 
                          : (language === 'ar' ? 'رفع وربط' : 'Upload & Link')
                        }
                      </Button>
                    </div>
                  </div>
                )}

                {/* Link Existing File Form */}
                {evidenceAttachMode === 'link' && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="space-y-4">
                      {allEvidence && allEvidence.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {allEvidence.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <FileText className="h-5 w-5 text-green-500" />
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {item.fileName} • {(item.fileSize / 1024).toFixed(1)} KB • v{item.version}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLinkExistingEvidence(item.id)}
                              >
                                {language === 'ar' ? 'ربط' : 'Link'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-500">
                            {language === 'ar' ? 'لا توجد أدلة متاحة للربط' : 'No evidence available to link'}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {language === 'ar' ? 'قم برفع أدلة جديدة أولاً' : 'Upload new evidence first'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Target className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {language === 'ar' ? 'اختر ضابطاً لإرفاق الأدلة' : 'Select a control to attach evidence'}
                </p>
              </div>
            )}
          </div>



        </TabsContent>
        
        {/* Tab 4: Workflow */}
        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Workflow</CardTitle>
              <Badge variant="secondary" className="capitalize">{currentState.replaceAll("_"," ")}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Route editor (visible to admins/compliance) */}
              {can && can("change_user_permissions") && (
                <div className="space-y-3">
                  <Label>Review route (in order)</Label>
                  <div className="space-y-2">
                    {routeDraft.map((s, idx) => {
                      const selectedUser = Array.isArray(users) ? users.find((u: any) => u.id === s.userId) : undefined;
                      return (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Select
                            value={s.userId}
                            onValueChange={(value) => {
                              setRouteDraft(prev=>prev.map((x,i)=>i===idx?{...x,userId:value}:x));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select user">
                                {selectedUser && (
                                  <div className="flex items-center gap-2">
                                    <UserAvatar 
                                      user={{
                                        firstName: selectedUser.firstName || 'Unknown',
                                        lastName: selectedUser.lastName || 'User',
                                        email: selectedUser.email,
                                        profilePicture: selectedUser.profilePicture
                                      }} 
                                      size="xs" 
                                    />
                                    <span className="text-sm">
                                      {selectedUser.firstName} {selectedUser.lastName}
                                    </span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Array.isArray(users) ? users.map((user: any) => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-2">
                                    <UserAvatar 
                                      user={{
                                        firstName: user.firstName || 'Unknown',
                                        lastName: user.lastName || 'User',
                                        email: user.email,
                                        profilePicture: user.profilePicture
                                      }} 
                                      size="sm" 
                                    />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium">
                                        {user.firstName} {user.lastName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {user.email}
                                      </span>
                                    </div>
                                  </div>
                                </SelectItem>
                              )) : null}
                            </SelectContent>
                          </Select>
                        <Input
                          value={s.role}
                          onChange={e=>{
                            const v = e.target.value;
                            setRouteDraft(prev=>prev.map((x,i)=>i===idx?{...x,role:v}:x));
                          }}
                          placeholder="role (analyst, lead, manager...)"
                        />
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" onClick={()=>{
                            setRouteDraft(prev => prev.toSpliced(idx,1));
                          }}>Remove</Button>
                          {idx===routeDraft.length-1 && (
                            <Button type="button" variant="outline" onClick={()=>{
                              setRouteDraft(prev => [...prev, { userId:"", role:"" }]);
                            }}>Add step</Button>
                          )}
                        </div>
                      </div>
                    );
                    })}
                    {routeDraft.length===0 && (
                      <Button type="button" variant="outline" onClick={()=>setRouteDraft([{ userId:"", role:"" }])}>
                        Add first step
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button type="button" onClick={()=>mSetRoute.mutate(routeDraft.filter(s=>s.userId && s.role))} disabled={mSetRoute.isPending}>
                      Save route
                    </Button>
                  </div>
                </div>
              )}

              {/* Route viewer */}
              <div className="space-y-2">
                <Label>Route</Label>
                <ol className="list-decimal pl-5 space-y-1">
                  {(wfData?.route || []).sort((a,b)=>a.stepIndex-b.stepIndex).map(r=>{
                    const user = Array.isArray(users) ? users.find((u: any) => u.id === r.userId) : undefined;
                    return (
                      <li key={r.id} className="flex items-center gap-3 py-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar 
                            user={{
                              firstName: user?.firstName || 'Unknown',
                              lastName: user?.lastName || 'User',
                              email: user?.email || r.userId,
                              profilePicture: user?.profilePicture
                            }} 
                            size="sm" 
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {user ? `${user.firstName} ${user.lastName}` : r.userId}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user?.email || r.userId}
                            </span>
                          </div>
                        </div>
                        {currentAssigneeId === r.userId && <Badge variant="secondary">current</Badge>}
                        <span className="text-muted-foreground text-xs">({r.role})</span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Submit to next (only current assignee) */}
                {user && (user as any)?.claims?.sub === currentAssigneeId && (
                  <Button type="button" onClick={()=>mSubmit.mutate()} disabled={mSubmit.isPending}>
                    Submit to next
                  </Button>
                )}

                {/* Return dialog (only workflow reviewers) */}
                {can && can("workflow_return") && (
                  <>
                    <Button type="button" variant="outline" onClick={()=>setReturnOpen(true)}>Return to collaborator</Button>
                    <ReturnDialog
                      open={returnOpen}
                      onOpenChange={setReturnOpen}
                      candidates={candidates}
                      onConfirm={(p)=> {
                        // If user is compliance and you want "Reject" path, you can call mReject here instead:
                        if (can && can("approve_controls") && currentState === "compliance_review") {
                          mReject.mutate(p);
                        } else {
                          mReturn.mutate(p);
                        }
                      }}
                    />
                  </>
                )}

                {/* Compliance Approve (only compliance/admin) */}
                {can && can("approve_controls") && currentState === "compliance_review" && (
                  <Button type="button" variant="secondary" onClick={()=>mApprove.mutate()} disabled={mApprove.isPending}>
                    Approve (final)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Delete Button - Left Side */}
        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'حذف المهمة' : 'Delete Task'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {language === 'ar' ? 'تأكيد حذف المهمة' : 'Confirm Task Deletion'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {language === 'ar' 
                    ? 'هل أنت متأكد أنك تريد حذف هذه المهمة؟ هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع البيانات المرتبطة بالمهمة.'
                    : 'Are you sure you want to delete this task? This action cannot be undone and will remove all associated task data.'
                  }
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteTask}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting 
                    ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...')
                    : (language === 'ar' ? 'حذف' : 'Delete')
                  }
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        {/* Cancel and Save Buttons - Right Side */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleTaskSubmit} disabled={isLoading}>
            {isLoading ? (
              language === 'ar' ? 'جاري الحفظ...' : 'Saving...'
            ) : (
              language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'
            )}
          </Button>
        </div>
      </div>

      {/* Control Info Dialog */}
      <ControlInfoDialog 
        isOpen={isControlInfoDialogOpen}
        onClose={() => setIsControlInfoDialogOpen(false)}
        control={selectedControlForInfo}
        projectId={task.projectId}
      />
    </div>
  );
}

// Control Selector Component
function ControlSelector({ 
  controls, 
  onAddControls, 
  language, 
  isLoading,
  onControlClick 
}: {
  controls: any[];
  onAddControls: (controlIds: number[]) => void;
  language: string;
  isLoading: boolean;
  onControlClick?: (control: any) => void;
}) {
  const [selectedControls, setSelectedControls] = useState<number[]>([]);

  const handleControlToggle = (controlId: number) => {
    setSelectedControls(prev => 
      prev.includes(controlId) 
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const handleSelectAll = () => {
    if (selectedControls.length === controls.length) {
      setSelectedControls([]);
    } else {
      setSelectedControls(controls.map(c => c.control?.id || c.eccControl?.id || c.id));
    }
  };

  const handleAddSelected = () => {
    if (selectedControls.length > 0) {
      onAddControls(selectedControls);
      setSelectedControls([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {language === 'ar' ? 'اختر الضوابط' : 'Select Controls'} ({selectedControls.length}/{controls.length})
        </span>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSelectAll}
          >
            {selectedControls.length === controls.length 
              ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
              : (language === 'ar' ? 'تحديد الكل' : 'Select All')
            }
          </Button>
          <Button 
            size="sm"
            onClick={handleAddSelected}
            disabled={selectedControls.length === 0 || isLoading}
          >
            {isLoading 
              ? (language === 'ar' ? 'جاري الإضافة...' : 'Adding...')
              : (language === 'ar' ? 'إضافة المحددة' : 'Add Selected')
            }
          </Button>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {controls.map((control: any) => (
          <div key={control.id} className="flex items-start space-x-3 p-3 border rounded-lg">
            <Checkbox
              checked={selectedControls.includes(control.control?.id)}
              onCheckedChange={() => handleControlToggle(control.control?.id)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant="secondary" 
                  className="text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onControlClick?.(control.control);
                  }}
                >
                  {(control.control || control.eccControl || control.customControl)?.code}
                </Badge>
              </div>
              <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                {(() => {
                  const controlData = control.control || control.eccControl || control.customControl;
                  return language === 'ar' && (controlData?.subdomainAr || controlData?.subDomainAr)
                    ? (controlData.subdomainAr || controlData.subDomainAr)
                    : (controlData?.subdomainEn || controlData?.subDomain);
                })()}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {(() => {
                  const controlData = control.control || control.eccControl || control.customControl;
                  return language === 'ar' && (controlData?.controlAr || controlData?.control)
                    ? (controlData.controlAr || controlData.control)
                    : (controlData?.controlEn || controlData?.control);
                })()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
