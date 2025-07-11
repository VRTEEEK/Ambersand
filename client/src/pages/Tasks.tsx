import { useState, useCallback } from 'react';
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
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'review', 'completed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional(),
  projectId: z.number().optional(),
  assigneeEmail: z.string().optional(),
  controlId: z.number().optional(),
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

// Sortable Task Card Component
function SortableTaskCard({ task, language }: { task: Task; language: string }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
            {language === 'ar' && task.titleAr ? task.titleAr : task.title}
          </h3>
        </div>
        <Badge className={getPriorityColor(task.priority)}>
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
              {task.assigneeId.length > 20 ? `${task.assigneeId.substring(0, 20)}...` : task.assigneeId}
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
}

export default function Tasks() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
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

  // Group tasks by status
  const groupedTasks = statusColumns.reduce((acc, column) => {
    acc[column.id] = (tasks || []).filter((task: Task) => task.status === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

  // Filter tasks
  const filteredTasks = tasks?.filter((task: Task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.titleAr && task.titleAr.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  }) || [];

  // Apply filters to grouped tasks
  const filteredGroupedTasks = statusColumns.reduce((acc, column) => {
    acc[column.id] = filteredTasks.filter((task: Task) => task.status === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

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
      assigneeEmail: '',
      controlId: undefined,
    },
  });

  // Handle form submission
  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  // Utility functions
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Handle error states
  if (error) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'إضافة مهمة' : 'Add Task'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إضافة مهمة جديدة' : 'Add New Task'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'العنوان' : 'Title'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل عنوان المهمة' : 'Enter task title'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="titleAr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'العنوان بالعربية' : 'Title (Arabic)'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل عنوان المهمة بالعربية' : 'Enter task title in Arabic'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'الوصف' : 'Description'}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={language === 'ar' ? 'أدخل وصف المهمة' : 'Enter task description'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{language === 'ar' ? 'الأولوية' : 'Priority'}</FormLabel>
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
                      control={form.control}
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

                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'المشروع' : 'Project'}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر المشروع' : 'Select project'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects.map((project: any) => (
                              <SelectItem key={project.id} value={project.id.toString()}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigneeEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{language === 'ar' ? 'المُكلف' : 'Assignee'}</FormLabel>
                        <FormControl>
                          <Input placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني أو الاسم' : 'Enter email or name'} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button type="submit" disabled={createTaskMutation.isPending}>
                      {createTaskMutation.isPending ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء' : 'Create')}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {statusColumns.map((column) => {
              const StatusIcon = column.icon;
              const columnTasks = filteredGroupedTasks[column.id] || [];
              
              return (
                <Card key={column.id} className="bg-gray-50 dark:bg-gray-800">
                  <CardHeader className="pb-3">
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
                  <CardContent 
                    className="pt-0 min-h-[400px]"
                    id={`column-${column.id}`}
                  >
                    <SortableContext items={columnTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
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
                          columnTasks.map((task) => (
                            <SortableTaskCard key={task.id} task={task} language={language} />
                          ))
                        )}
                      </div>
                    </SortableContext>
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
      </div>
    </AppLayout>
  );
}
