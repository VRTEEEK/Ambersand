import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Search, 
  Calendar, 
  User, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Target,
  FileText,
  Users,
  GripVertical,
} from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import TaskWizard from '@/components/tasks/TaskWizard';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'review', 'completed', 'blocked']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional(),
  projectId: z.number().optional(),
  assigneeId: z.string().optional(),
  controlId: z.number().nullable().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface Task {
  id: number;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assigneeId?: string;
  projectId?: number;
  eccControlId?: number;
  createdAt: string;
  updatedAt: string;
}

// Utility functions
const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'high': return 'bg-[#ea580b] text-white dark:bg-[#ea580b] dark:text-white';
    case 'urgent': return 'bg-[#ea580b] text-white dark:bg-[#ea580b] dark:text-white';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'blocked': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'overdue': return 'bg-[#ea580b] text-white dark:bg-[#ea580b] dark:text-white';
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

// Droppable Column Component with enhanced drop zone
const DroppableColumn = memo(function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[500px] w-full p-2 rounded-lg transition-all duration-200 ${
        isOver 
          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-600 border-dashed' 
          : 'border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
      }`}
      style={{
        minHeight: '500px',
        position: 'relative',
      }}
    >
      {children}
      {/* Invisible drop zone overlay that covers the entire column */}
      {isOver && (
        <div className="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg pointer-events-none flex items-center justify-center">
          <div className="text-blue-600 dark:text-blue-400 font-medium text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded-md shadow-sm border border-blue-200 dark:border-blue-700">
            Drop here
          </div>
        </div>
      )}
    </div>
  );
});

// Sortable Task Card Component - Memoized for performance
const SortableTaskCard = memo(function SortableTaskCard({ task, language, onTaskClick, users }: { task: Task; language: string; onTaskClick: (task: Task) => void; users: any[] }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger click when dragging
    if (isDragging) return;
    // Only trigger on non-drag handle areas
    const target = e.target as HTMLElement;
    if (target.closest('[data-drag-handle]') || target.closest('.drag-handle')) return;
    e.preventDefault();
    onTaskClick(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={handleClick}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <button 
            {...listeners}
            type="button"
            className="drag-handle cursor-grab active:cursor-grabbing p-1 -m-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 touch-none"
            style={{ touchAction: 'none' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </button>
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
            {language === 'ar' && task.titleAr ? task.titleAr : task.title}
          </h3>
        </div>
        <Badge 
          className={getPriorityColor(task.priority)}
          style={{ backgroundColor: task.priority === 'urgent' ? '#eab308' : undefined }}
        >
          {task.priority === 'low' ? (language === 'ar' ? 'منخفضة' : 'Low') :
           task.priority === 'medium' ? (language === 'ar' ? 'متوسطة' : 'Medium') :
           task.priority === 'high' ? (language === 'ar' ? 'عالية' : 'High') :
           (language === 'ar' ? 'عاجلة' : 'Urgent')}
        </Badge>
      </div>
      
      {task.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        {task.assigneeId && (
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span className="truncate max-w-24">
              {(() => {
                const user = users.find(u => u.id === task.assigneeId);
                if (user) {
                  return user.firstName && user.lastName 
                    ? `${user.firstName} ${user.lastName}`
                    : user.email;
                }
                return task.assigneeId;
              })()}
            </span>
          </div>
        )}
        {task.dueDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          ID: {task.id}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="h-3 w-3" />
          <span>{new Date(task.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
});

export default function Tasks() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskWizardOpen, setIsTaskWizardOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Debounce search input for performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch tasks with fresh data - remove cache to get real-time data
  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['/api/tasks'],
    queryFn: async () => {
      console.log('🔄 Fetching tasks...');
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      console.log('✅ Tasks fetched:', data);
      return data;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 0, // Always fetch fresh data
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
  });

  // Fetch users for name lookup
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Fetch task controls for the selected task
  const { data: taskControls = [] } = useQuery({
    queryKey: ['/api/tasks', selectedTask?.id, 'controls'],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      console.log('🔍 Fetching controls for task:', selectedTask.id);
      const response = await fetch(`/api/tasks/${selectedTask.id}/controls`);
      if (!response.ok) throw new Error('Failed to fetch task controls');
      const data = await response.json();
      console.log('✅ Retrieved task controls:', data);
      return data;
    },
    enabled: !!selectedTask?.id && isEditDialogOpen,
  });

  // Simple drag and drop sensors without constraints
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update task status mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      console.log('🔄 Updating task status:', { id, status });
      await apiRequest(`/api/tasks/${id}`, 'PUT', { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      refetch(); // Force refetch to get fresh data
      toast({
        title: language === 'ar' ? 'تم تحديث المهمة' : 'Task Updated',
        description: language === 'ar' ? 'تم تحديث حالة المهمة بنجاح' : 'Task status updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Error updating task status:', error);
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحديث حالة المهمة' : 'Failed to update task status',
        variant: 'destructive',
      });
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      console.log('🔄 Creating task:', data);
      const taskData = {
        ...data,
        assigneeId: data.assigneeEmail, // Map to assigneeId
        eccControlId: data.controlId, // Map to eccControlId
      };
      await apiRequest('/api/tasks', 'POST', taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      refetch(); // Force refetch
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: language === 'ar' ? 'تم إنشاء المهمة' : 'Task Created',
        description: language === 'ar' ? 'تم إنشاء المهمة بنجاح' : 'Task created successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Error creating task:', error);
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في إنشاء المهمة' : 'Failed to create task',
        variant: 'destructive',
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData & { id: number }) => {
      console.log('🔄 Updating task:', data);
      const taskData = {
        ...data,
        assigneeId: data.assigneeId === 'unassigned' ? null : data.assigneeId,
        eccControlId: data.controlId, // Map to eccControlId
        dueDate: data.dueDate || null,
      };
      await apiRequest(`/api/tasks/${data.id}`, 'PUT', taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      refetch(); // Force refetch
      setIsEditDialogOpen(false);
      setSelectedTask(null);
      editForm.reset();
      toast({
        title: language === 'ar' ? 'تم تحديث المهمة' : 'Task Updated',
        description: language === 'ar' ? 'تم تحديث المهمة بنجاح' : 'Task updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Error updating task:', error);
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => window.location.href = "/api/login", 500);
        return;
      }
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في تحديث المهمة' : 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t: Task) => t.id === active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Check if dropping on a different column
    if (typeof overId === 'string' && overId.startsWith('column-')) {
      const newStatus = overId.replace('column-', '');
      const task = tasks.find((t: Task) => t.id === activeId);
      
      if (task && task.status !== newStatus) {
        updateTaskStatusMutation.mutate({
          id: task.id,
          status: newStatus,
        });
      }
    }

    setActiveTask(null);
  }, [tasks, updateTaskStatusMutation]);

  // Status mapping for the kanban board
  const statusColumns = [
    { id: 'pending', title: language === 'ar' ? 'لم تبدأ' : 'To Do', icon: Clock },
    { id: 'in-progress', title: language === 'ar' ? 'قيد التنفيذ' : 'In Progress', icon: AlertCircle },
    { id: 'review', title: language === 'ar' ? 'للمراجعة' : 'Review', icon: Search },
    { id: 'completed', title: language === 'ar' ? 'مكتملة' : 'Completed', icon: CheckCircle2 },
  ];

  // Memoize filtered tasks for performance with debounced search
  const filteredTasks = useMemo(() => {
    return tasks?.filter((task: Task) => {
      const matchesSearch = debouncedSearchTerm === '' || 
                           task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           (task.titleAr && task.titleAr.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    }) || [];
  }, [tasks, debouncedSearchTerm, statusFilter, priorityFilter]);

  // Memoize grouped tasks for performance
  const filteredGroupedTasks = useMemo(() => {
    return statusColumns.reduce((acc, column) => {
      acc[column.id] = filteredTasks.filter((task: Task) => task.status === column.id);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [filteredTasks, statusColumns]);

  // Form for creating tasks
  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      projectId: undefined,
      assigneeId: 'unassigned',
      controlId: undefined,
    },
  });

  // Form for editing tasks
  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      status: 'pending',
      priority: 'medium',
      dueDate: '',
      projectId: undefined,
      assigneeId: 'unassigned',
      controlId: undefined,
    },
  });

  // Handle form submission
  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  // Handle edit form submission with better error handling
  const onEditSubmit = (data: TaskFormData) => {
    console.log('📝 Edit form submitted with data:', data);
    console.log('📝 Selected task:', selectedTask);
    
    if (!selectedTask) {
      console.error('❌ No selected task for update');
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'لم يتم تحديد مهمة للتحديث' : 'No task selected for update',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate form data
    if (!data.title || data.title.trim() === '') {
      console.error('❌ Title is required');
      return;
    }
    
    // Convert assignee field - handle "unassigned" case
    const updateData = {
      ...data,
      assigneeId: data.assigneeId === 'unassigned' ? null : data.assigneeId,
      dueDate: data.dueDate || null,
      id: selectedTask.id,
    };
    
    updateTaskMutation.mutate(updateData);
  };

  // Handle task click for editing
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    // Populate edit form with task data
    editForm.reset({
      title: task.title,
      titleAr: task.titleAr || '',
      description: task.description || '',
      descriptionAr: task.descriptionAr || '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate || '',
      assigneeId: task.assigneeId || 'unassigned',
      controlId: task.eccControlId,
    });
    setIsEditDialogOpen(true);
  };



  // Handle error states
  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: '#eab308' }} />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {language === 'ar' ? 'خطأ في تحميل المهام' : 'Error loading tasks'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {language === 'ar' ? 'حدث خطأ أثناء تحميل المهام' : 'There was an error loading tasks'}
            </p>
            <Button onClick={() => refetch()}>
              {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'إدارة المهام' : 'Task Management'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {language === 'ar' ? 'نظام لوحة كانبان لإدارة المهام' : 'Kanban board system for task management'}
            </p>
            {tasks && tasks.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {language === 'ar' 
                  ? `عرض ${filteredTasks.length} من ${tasks.length} مهمة` 
                  : `Showing ${filteredTasks.length} of ${tasks.length} tasks`}
                {filteredTasks.length > 200 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    {language === 'ar' ? '(استخدم الفلتر لتحسين الأداء)' : '(Use filters for better performance)'}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setIsTaskWizardOpen(true)}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Plus className="h-4 w-4" />
              {language === 'ar' ? 'إنشاء مهمة' : 'Create Task'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="search"
                  placeholder={language === 'ar' ? 'بحث في المهام...' : 'Search tasks...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل الحالات' : 'All Status'}</SelectItem>
                  <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'To Do'}</SelectItem>
                  <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                  <SelectItem value="review">{language === 'ar' ? 'للمراجعة' : 'Review'}</SelectItem>
                  <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === 'ar' ? 'كل الأولويات' : 'All Priority'}</SelectItem>
                  <SelectItem value="urgent">{language === 'ar' ? 'عاجلة' : 'Urgent'}</SelectItem>
                  <SelectItem value="high">{language === 'ar' ? 'عالية' : 'High'}</SelectItem>
                  <SelectItem value="medium">{language === 'ar' ? 'متوسطة' : 'Medium'}</SelectItem>
                  <SelectItem value="low">{language === 'ar' ? 'منخفضة' : 'Low'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[700px]">
            {statusColumns.map((column) => {
              const StatusIcon = column.icon;
              const columnTasks = filteredGroupedTasks[column.id] || [];
              
              return (
                <Card key={column.id} className="bg-gray-50 dark:bg-gray-800 flex flex-col h-full">
                  <CardHeader className="flex flex-col space-y-1.5 p-6 pb-3 bg-[#0d94881a] flex-shrink-0">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className="h-5 w-5" />
                        <span>{column.title}</span>
                      </div>
                      <Badge variant="outline" className="bg-white dark:bg-gray-700">
                        {columnTasks.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 flex flex-col p-2">
                    <DroppableColumn id={column.id}>
                      <SortableContext items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-3 flex-1 overflow-y-auto">
                          {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                              <div key={i} className="p-4 bg-white dark:bg-gray-700 rounded-lg border">
                                <Skeleton className="h-4 w-32 mb-2" />
                                <Skeleton className="h-3 w-24 mb-2" />
                                <Skeleton className="h-3 w-20" />
                              </div>
                            ))
                          ) : columnTasks.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                              <p className="text-sm">
                                {language === 'ar' ? 'لا توجد مهام' : 'No tasks'}
                              </p>
                            </div>
                          ) : (
                            <>
                              {columnTasks.slice(0, 50).map((task) => (
                                <SortableTaskCard key={task.id} task={task} language={language} onTaskClick={handleTaskClick} users={users} />
                              ))}
                              {columnTasks.length > 50 && (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                  <p className="text-sm">
                                    {language === 'ar' 
                                      ? `+${columnTasks.length - 50} مهام أخرى` 
                                      : `+${columnTasks.length - 50} more tasks`}
                                  </p>
                                  <p className="text-xs mt-1">
                                    {language === 'ar' 
                                      ? 'استخدم الفلترة للعثور على مهام محددة' 
                                      : 'Use filters to find specific tasks'}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </SortableContext>
                    </DroppableColumn>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg transform rotate-2">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                    {language === 'ar' && activeTask.titleAr ? activeTask.titleAr : activeTask.title}
                  </h3>
                  <Badge className={getPriorityColor(activeTask.priority)}>
                    {activeTask.priority}
                  </Badge>
                </div>
                {activeTask.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {language === 'ar' && activeTask.descriptionAr ? activeTask.descriptionAr : activeTask.description}
                  </p>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

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
                            {users.map((user: any) => (
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
                    onClick={(e) => {
                      console.log('🔘 Update button clicked');
                      e.preventDefault();
                      editForm.handleSubmit(onEditSubmit, (errors) => {
                        console.error('❌ Form validation errors:', errors);
                      })();
                    }}
                  >
                    {updateTaskMutation.isPending ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Task Wizard */}
        <TaskWizard 
          isOpen={isTaskWizardOpen}
          onClose={() => setIsTaskWizardOpen(false)}
          projectId={selectedProjectId || undefined}
        />
      </div>
    </AppLayout>
  );
}
