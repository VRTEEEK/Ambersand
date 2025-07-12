import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/hooks/use-i18n";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema, type Task } from "@shared/schema";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Edit3,
  FileText,
  Target,
  Upload,
  Download,
  Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t, language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Fetch task details
  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['/api/tasks', id],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${id}`);
      if (!response.ok) throw new Error('Failed to fetch task');
      return response.json();
    },
    enabled: !!id,
  });

  // Fetch project details if task has a project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', task?.projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${task.projectId}`);
      if (!response.ok) throw new Error('Failed to fetch project');
      return response.json();
    },
    enabled: !!task?.projectId,
  });

  // Fetch ECC control details if task is associated with one
  const { data: eccControl, isLoading: controlLoading } = useQuery({
    queryKey: ['/api/ecc-controls', task?.eccControlId],
    queryFn: async () => {
      const response = await fetch(`/api/ecc-controls/${task.eccControlId}`);
      if (!response.ok) throw new Error('Failed to fetch ECC control');
      return response.json();
    },
    enabled: !!task?.eccControlId,
  });

  // Fetch task evidence
  const { data: taskEvidence = [], isLoading: evidenceLoading } = useQuery({
    queryKey: ['/api/evidence', { taskId: id }],
    queryFn: async () => {
      const response = await fetch(`/api/evidence?taskId=${id}`);
      if (!response.ok) throw new Error('Failed to fetch evidence');
      return response.json();
    },
    enabled: !!id,
  });

  // Edit form
  const editForm = useForm({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: task?.title || '',
      titleAr: task?.titleAr || '',
      description: task?.description || '',
      descriptionAr: task?.descriptionAr || '',
      status: task?.status || 'pending',
      priority: task?.priority || 'medium',
      dueDate: task?.dueDate || '',
      assigneeId: task?.assigneeId || '',
      eccControlId: task?.eccControlId || undefined,
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', id] });
      setIsEditDialogOpen(false);
      toast({
        title: language === 'ar' ? 'تم التحديث بنجاح' : 'Task Updated',
        description: language === 'ar' ? 'تم تحديث المهمة بنجاح' : 'Task has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في تحديث المهمة' : 'Failed to update task'),
        variant: 'destructive',
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" style={{ color: '#16a34a' }} />;
      case 'in-progress':
        return <Clock className="h-4 w-4" style={{ color: '#ea580b' }} />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" style={{ color: '#eab308' }} />;
      default:
        return <Clock className="h-4 w-4" style={{ color: '#6b7280' }} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return language === 'ar' ? 'مكتملة' : 'Completed';
      case 'in-progress':
        return language === 'ar' ? 'قيد التنفيذ' : 'In Progress';
      case 'pending':
        return language === 'ar' ? 'لم تبدأ' : 'Pending';
      default:
        return status;
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high':
        return language === 'ar' ? 'عالية' : 'High';
      case 'medium':
        return language === 'ar' ? 'متوسطة' : 'Medium';
      case 'low':
        return language === 'ar' ? 'منخفضة' : 'Low';
      default:
        return priority;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const onEditSubmit = async (data: any) => {
    try {
      await updateTaskMutation.mutateAsync(data);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  if (taskLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-600 mb-2">
            {language === 'ar' ? 'المهمة غير موجودة' : 'Task Not Found'}
          </h2>
          <p className="text-slate-500 mb-4">
            {language === 'ar' ? 'لم يتم العثور على المهمة المطلوبة' : 'The requested task could not be found.'}
          </p>
          <Button onClick={() => setLocation('/tasks')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'العودة للمهام' : 'Back to Tasks'}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLocation('/tasks')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'العودة للمهام' : 'Back to Tasks'}
            </Button>
            <h1 className="text-2xl font-bold text-slate-800">
              {language === 'ar' && task.titleAr ? task.titleAr : task.title}
            </h1>
          </div>
          <Button onClick={() => setIsEditDialogOpen(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'تعديل' : 'Edit'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status and Priority */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <span className="font-medium">{getStatusText(task.status)}</span>
                  </div>
                  <Badge variant={getPriorityBadgeVariant(task.priority)}>
                    {getPriorityText(task.priority)}
                  </Badge>
                </div>

                {/* Description */}
                {(task.description || task.descriptionAr) && (
                  <div>
                    <h4 className="font-medium mb-2">
                      {language === 'ar' ? 'الوصف' : 'Description'}
                    </h4>
                    <p className="text-slate-600">
                      {language === 'ar' && task.descriptionAr ? task.descriptionAr : task.description}
                    </p>
                  </div>
                )}

                {/* Due Date */}
                {task.dueDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">
                      {language === 'ar' ? 'تاريخ الاستحقاق:' : 'Due Date:'} {formatDate(task.dueDate)}
                    </span>
                  </div>
                )}

                {/* Assignee */}
                {task.assigneeId && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-600">
                      {language === 'ar' ? 'المسؤول:' : 'Assignee:'} {task.assigneeId}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Associated Control */}
            {eccControl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {language === 'ar' ? 'الضابط المرتبط' : 'Associated Control'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                    <div className="flex items-start gap-3">
                      <Badge className="bg-teal-600 text-white">
                        {eccControl.code}
                      </Badge>
                      <div className="flex-1">
                        <h4 className="font-medium text-teal-900 mb-2">
                          {language === 'ar' && eccControl.controlAr 
                            ? eccControl.controlAr 
                            : eccControl.controlEn}
                        </h4>
                        {eccControl.domain && (
                          <p className="text-sm text-teal-700">
                            {language === 'ar' ? 'المجال:' : 'Domain:'} {eccControl.domain}
                            {eccControl.subdomain && ` > ${eccControl.subdomain}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Evidence */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {language === 'ar' ? 'الأدلة المرفقة' : 'Attached Evidence'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evidenceLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : taskEvidence.length > 0 ? (
                  <div className="space-y-3">
                    {taskEvidence.map((evidence: any) => (
                      <div key={evidence.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-slate-500" />
                          <div>
                            <p className="font-medium text-sm">{evidence.title}</p>
                            <p className="text-xs text-slate-500">
                              {language === 'ar' ? 'تاريخ الرفع:' : 'Uploaded:'} {formatDate(evidence.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p>{language === 'ar' ? 'لا توجد أدلة مرفقة' : 'No evidence attached'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Info */}
            {project && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'ar' ? 'المشروع' : 'Project'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-medium">
                      {language === 'ar' && project.nameAr ? project.nameAr : project.name}
                    </h4>
                    <p className="text-sm text-slate-600">
                      {language === 'ar' && project.descriptionAr ? project.descriptionAr : project.description}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setLocation(`/projects/${project.id}`)}
                      className="w-full"
                    >
                      {language === 'ar' ? 'عرض المشروع' : 'View Project'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setIsEditDialogOpen(true)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'تعديل المهمة' : 'Edit Task'}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Upload className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'رفع دليل' : 'Upload Evidence'}
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'إنشاء تقرير' : 'Generate Report'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'تعديل المهمة' : 'Edit Task'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' ? 'تعديل تفاصيل المهمة' : 'Edit task details and information'}
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الحالة' : 'Select status'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">{language === 'ar' ? 'لم تبدأ' : 'Pending'}</SelectItem>
                            <SelectItem value="in-progress">{language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}</SelectItem>
                            <SelectItem value="completed">{language === 'ar' ? 'مكتملة' : 'Completed'}</SelectItem>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'ar' ? 'اختر الأولوية' : 'Select priority'} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">{language === 'ar' ? 'منخفضة' : 'Low'}</SelectItem>
                            <SelectItem value="medium">{language === 'ar' ? 'متوسطة' : 'Medium'}</SelectItem>
                            <SelectItem value="high">{language === 'ar' ? 'عالية' : 'High'}</SelectItem>
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

                <FormField
                  control={editForm.control}
                  name="assigneeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{language === 'ar' ? 'المسؤول' : 'Assignee'}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={language === 'ar' ? 'أدخل معرف المسؤول' : 'Enter assignee ID'} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button type="submit" disabled={updateTaskMutation.isPending}>
                    {updateTaskMutation.isPending 
                      ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') 
                      : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}