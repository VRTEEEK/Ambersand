import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/use-i18n';

// Task creation schema
const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
  projectId: z.number(),
  controlIds: z.array(z.number()).min(1, 'At least one control must be selected'),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
}

export default function TaskWizard({ isOpen, onClose, projectId }: TaskWizardProps) {
  const { language } = useI18n();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedControls, setSelectedControls] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(projectId || null);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      titleAr: '',
      description: '',
      descriptionAr: '',
      priority: 'medium',
      dueDate: '',
      assigneeId: '',
      projectId: selectedProjectId || undefined,
      controlIds: [],
    },
  });

  // Fetch projects for selection
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isOpen,
  });

  // Fetch project controls
  const { data: projectControls = [] } = useQuery({
    queryKey: ['/api/projects', selectedProjectId, 'controls'],
    enabled: isOpen && !!selectedProjectId,
  });

  // Fetch users for assignee dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { controlIds, ...taskData } = data;
      
      // Create task first
      const task = await apiRequest('/api/tasks', {
        method: 'POST',
        body: taskData,
      });

      // Then associate controls with the task
      if (controlIds.length > 0) {
        await apiRequest(`/api/tasks/${task.id}/controls`, {
          method: 'POST',
          body: { controlIds },
        });
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      handleClose();
    },
  });

  const handleControlToggle = (controlId: number) => {
    setSelectedControls(prev => 
      prev.includes(controlId) 
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const handleNext = () => {
    if (step === 1 && !selectedProjectId) {
      return;
    }
    if (step === 2 && selectedControls.length === 0) {
      return;
    }
    form.setValue('controlIds', selectedControls);
    form.setValue('projectId', selectedProjectId!);
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const onSubmit = (data: TaskFormData) => {
    createTaskMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
    setStep(1);
    setSelectedControls([]);
    setSelectedProjectId(projectId || null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 2 ? 'bg-blue-600 text-white' : step > 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'الخطوة 1: اختر المشروع' : 'Step 1: Select Project'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'اختر المشروع الذي ستكون المهمة جزءاً منه' 
                    : 'Select the project that this task will be part of'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {projects.map((project: any) => (
                    <div 
                      key={project.id} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedProjectId === project.id 
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="radio"
                          id={`project-${project.id}`}
                          name="project"
                          checked={selectedProjectId === project.id}
                          onChange={() => setSelectedProjectId(project.id)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor={`project-${project.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {language === 'ar' && project.nameAr ? project.nameAr : project.name}
                          </Label>
                          {project.description && (
                            <p className="text-xs text-gray-600 mt-1">
                              {language === 'ar' && project.descriptionAr ? project.descriptionAr : project.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'الخطوة 2: اختر الضوابط' : 'Step 2: Select Controls'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'اختر الضوابط التي ستغطيها هذه المهمة من المشروع' 
                    : 'Select the controls that this task will address from the project'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Selected controls display */}
                  {selectedControls.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'الضوابط المختارة' : 'Selected Controls'}
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedControls.map(controlId => {
                          const control = projectControls.find((pc: any) => pc.eccControl?.id === controlId);
                          return (
                            <Badge key={controlId} variant="secondary" className="flex items-center gap-1">
                              {control?.eccControl?.code || controlId}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => handleControlToggle(controlId)}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Controls list */}
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {projectControls.map((projectControl: any) => (
                      <div key={projectControl.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <Checkbox
                          id={`control-${projectControl.eccControl?.id}`}
                          checked={selectedControls.includes(projectControl.eccControl?.id)}
                          onCheckedChange={() => handleControlToggle(projectControl.eccControl?.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={`control-${projectControl.eccControl?.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {projectControl.eccControl?.code} - {
                              language === 'ar' 
                                ? projectControl.eccControl?.controlAr 
                                : projectControl.eccControl?.controlEn
                            }
                          </Label>
                          <p className="text-xs text-gray-600 mt-1">
                            {language === 'ar' 
                              ? projectControl.eccControl?.domainAr 
                              : projectControl.eccControl?.domainEn
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'الخطوة 3: تفاصيل المهمة' : 'Step 3: Task Details'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'أدخل تفاصيل المهمة والمواعيد النهائية' 
                    : 'Enter task details and deadlines'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">{language === 'ar' ? 'العنوان' : 'Title'}</Label>
                      <Input
                        id="title"
                        {...form.register('title')}
                        placeholder={language === 'ar' ? 'أدخل عنوان المهمة' : 'Enter task title'}
                      />
                      {form.formState.errors.title && (
                        <p className="text-sm text-red-600 mt-1">{form.formState.errors.title.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="titleAr">{language === 'ar' ? 'العنوان بالعربية' : 'Title (Arabic)'}</Label>
                      <Input
                        id="titleAr"
                        {...form.register('titleAr')}
                        placeholder={language === 'ar' ? 'أدخل العنوان بالعربية' : 'Enter title in Arabic'}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">{language === 'ar' ? 'الوصف' : 'Description'}</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      placeholder={language === 'ar' ? 'أدخل وصف المهمة' : 'Enter task description'}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="priority">{language === 'ar' ? 'الأولوية' : 'Priority'}</Label>
                      <Select
                        value={form.watch('priority')}
                        onValueChange={(value) => form.setValue('priority', value as any)}
                      >
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
                      <Label htmlFor="dueDate">{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        {...form.register('dueDate')}
                      />
                    </div>

                    <div>
                      <Label htmlFor="assigneeId">{language === 'ar' ? 'المكلف' : 'Assignee'}</Label>
                      <Select
                        value={form.watch('assigneeId')}
                        onValueChange={(value) => form.setValue('assigneeId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'ar' ? 'اختر المكلف' : 'Select assignee'} />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Selected controls summary */}
                  <div>
                    <Label>{language === 'ar' ? 'الضوابط المختارة' : 'Selected Controls'}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedControls.map(controlId => {
                        const control = projectControls.find((pc: any) => pc.eccControl?.id === controlId);
                        return (
                          <Badge key={controlId} variant="secondary">
                            {control?.eccControl?.code || controlId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'السابق' : 'Back'}
                    </Button>
                    <Button type="submit" disabled={createTaskMutation.isPending}>
                      {createTaskMutation.isPending 
                        ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') 
                        : (language === 'ar' ? 'إنشاء المهمة' : 'Create Task')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={onClose}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={handleNext}
                disabled={!selectedProjectId}
              >
                {language === 'ar' ? 'التالي' : 'Next'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {language === 'ar' ? 'السابق' : 'Back'}
              </Button>
              <Button 
                onClick={handleNext}
                disabled={selectedControls.length === 0}
              >
                {language === 'ar' ? 'التالي' : 'Next'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}