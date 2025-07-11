import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AppLayout } from '@/components/layout/AppLayout';
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
  Activity
} from 'lucide-react';

const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in-progress', 'completed', 'blocked']).default('pending'),
  dueDate: z.string().optional(),
  assigneeEmail: z.string().optional(),
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
    taskForm.setValue('controlId', controlId || undefined);
    setIsTaskDialogOpen(true);
  };

  const selectedControl = projectControls?.find(
    (control: any) => control.eccControl.id === taskForm.watch('controlId')
  )?.eccControl;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  if (projectLoading || controlsLoading || tasksLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
                {tasks?.map((task: any) => (
                  <Card key={task.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {language === 'ar' && task.titleAr ? task.titleAr : task.title}
                          </h3>
                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getStatusColor(task.status)}>
                              {task.status}
                            </Badge>
                            <Badge className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                            {task.dueDate && (
                              <div className="flex items-center gap-1 text-sm text-gray-500">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="controls" className="space-y-6">
            {Object.entries(groupedControls).map(([domain, controls]) => (
              <div key={domain} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold bg-gradient-to-r from-teal-600 to-orange-600 bg-clip-text text-transparent">
                    {domain}
                  </h2>
                  <Badge variant="secondary">
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
                                {language === 'ar' ? control.eccControl.titleAr : control.eccControl.titleEn}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                                {language === 'ar' && control.eccControl.implementationGuidanceAr 
                                  ? control.eccControl.implementationGuidanceAr 
                                  : control.eccControl.implementationGuidanceEn}
                              </p>
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
                              {controlTasks.length} {language === 'ar' ? 'مهمة' : 'Tasks'}
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

                <FormField
                  control={taskForm.control}
                  name="controlId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">
                        {language === 'ar' ? 'الضابط المرتبط' : 'Related Control'} 
                        <span className="text-red-500 ml-1">*</span>
                      </FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الضابط' : 'Select a control'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projectControls?.map((control: any) => (
                            <SelectItem key={control.eccControl.id} value={control.eccControl.id.toString()}>
                              {control.eccControl.code} - {language === 'ar' ? control.eccControl.titleAr : control.eccControl.titleEn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Control Details Section */}
                {selectedControl && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      {language === 'ar' ? 'تفاصيل الضابط' : 'Control Details'}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {language === 'ar' ? 'الوصف:' : 'Description:'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'ar' ? selectedControl.implementationGuidanceAr : selectedControl.implementationGuidanceEn}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'ar' ? selectedControl.evidenceRequiredAr : selectedControl.evidenceRequiredEn}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                          placeholder={language === 'ar' ? 'أدخل اسم المُكلف أو البريد الإلكتروني' : 'Enter assignee name or email'}
                        />
                      </FormControl>
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
      </div>
    </AppLayout>
  );
}