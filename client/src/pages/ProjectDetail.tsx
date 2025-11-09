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
import EditTaskForm from '@/components/tasks/EditTaskForm';
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

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: [`/api/projects/${id}`],
    enabled: !!id,
  });

  const { data: projectControls = [], isLoading: controlsLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${id}/controls`],
    enabled: !!id,
  });

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery<any[]>({
    queryKey: [`/api/tasks?projectId=${id}`, refreshKey],
    enabled: !!id,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache
  });

  const { data: taskEvidence = [], refetch: refetchEvidence } = useQuery<any[]>({
    queryKey: [`/api/evidence?taskId=${editingTask?.id}`],
    enabled: !!editingTask?.id,
  });

  const { data: users = [], refetch: refetchUsers } = useQuery<any[]>({
    queryKey: ['/api/users', refreshKey],
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache
  });

  const { data: tasksWithControls, refetch: refetchTasksWithControls } = useQuery({
    queryKey: ['/api/tasks', id, 'with-controls', refreshKey],
    queryFn: async () => {
      if (!tasks) return [];
      
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const tasksWithControlsData = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const response = await fetch(`/api/tasks/${task.id}/controls`, { headers });
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
                <Badge variant="secondary">{(project as any)?.regulation?.code?.toUpperCase() || 'REGULATION'}</Badge>
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
          onClose={() => {
            setIsTaskWizardOpen(false);
            setSelectedControlId(null); // Clear selected control when closing
          }}
          preselectedProjectId={parseInt(id!)}
          preselectedControlId={selectedControlId || undefined}
          onTaskCreated={() => {
            console.log('🔄 ProjectDetail: Direct task created callback triggered');
            setRefreshKey(prev => prev + 1);
            refetchTasks();
            refetchTasksWithControls();
            setSelectedControlId(null); // Clear after task creation
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
          regulationCode={(project as any)?.regulation?.code || 'ecc'}
        />
      </div>
    </AppLayout>
  );
} 
