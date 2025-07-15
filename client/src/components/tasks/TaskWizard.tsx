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
import { Switch } from '@/components/ui/switch';
import { X, ArrowLeft, ArrowRight, Search } from 'lucide-react';
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
  dueDate: z.string().optional().nullable().transform(val => val || null),
  assigneeId: z.string().optional().nullable().transform(val => val || null),
  projectId: z.number(),
  controlIds: z.array(z.number()).min(1, 'At least one control must be selected'),
  createSeparateTasks: z.boolean().default(false),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
  preselectedProjectId?: number; // For when opened from project details
}

export default function TaskWizard({ isOpen, onClose, projectId, preselectedProjectId }: TaskWizardProps) {
  const { language } = useI18n();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(preselectedProjectId ? 2 : 1); // Skip project selection if preselected
  const [selectedControls, setSelectedControls] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(preselectedProjectId || projectId || null);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [domainSearch, setDomainSearch] = useState('');
  const [createSeparateTasks, setCreateSeparateTasks] = useState(false);
  const [domainControlCounts, setDomainControlCounts] = useState<Record<string, number>>({});

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
      createSeparateTasks: false,
    },
  });

  // Fetch projects for selection (only if not preselected)
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isOpen && !preselectedProjectId,
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

  // Get unique domains from project controls
  const domains = Array.from(new Set(
    projectControls.map((pc: any) => language === 'ar' ? pc.eccControl?.domainAr : pc.eccControl?.domainEn)
  )).filter(Boolean).sort();

  // Filter domains based on search
  const filteredDomains = domains.filter(domain => 
    domain.toLowerCase().includes(domainSearch.toLowerCase())
  );

  // Get controls for selected domain
  const domainControls = projectControls.filter((pc: any) => {
    const controlDomain = language === 'ar' ? pc.eccControl?.domainAr : pc.eccControl?.domainEn;
    return controlDomain === selectedDomain;
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { controlIds, createSeparateTasks, ...taskData } = data;
      
      // Clean up the task data - convert empty strings to null/undefined
      const cleanTaskData = {
        ...taskData,
        dueDate: taskData.dueDate || null,
        assigneeId: taskData.assigneeId || null,
        projectId: Number(taskData.projectId),
      };
      
      if (createSeparateTasks && controlIds.length > 1) {
        // Create separate tasks for each control
        const tasks = [];
        for (const controlId of controlIds) {
          const control = domainControls.find((pc: any) => pc.eccControl?.id === controlId);
          const controlTitle = language === 'ar' ? control?.eccControl?.controlAr : control?.eccControl?.controlEn;
          
          const taskResponse = await apiRequest('/api/tasks', 'POST', {
            ...cleanTaskData,
            title: `${cleanTaskData.title} - ${control?.eccControl?.code}`,
            titleAr: cleanTaskData.titleAr ? `${cleanTaskData.titleAr} - ${control?.eccControl?.code}` : '',
            description: cleanTaskData.description ? `${cleanTaskData.description}\n\nControl: ${controlTitle}` : `Control: ${controlTitle}`,
          });
          const task = await taskResponse.json();
          console.log('Created separate task:', task);

          // Associate single control with the task
          if (task && task.id) {
            console.log('Adding control to separate task:', task.id, [controlId]);
            await apiRequest(`/api/tasks/${task.id}/controls`, 'POST', { controlIds: [Number(controlId)] });
          }
          
          tasks.push(task);
        }
        return tasks;
      } else {
        // Create single task with multiple controls
        const taskResponse = await apiRequest('/api/tasks', 'POST', cleanTaskData);
        const task = await taskResponse.json();
        console.log('Created task:', task);

        // Associate all controls with the task
        if (controlIds.length > 0 && task && task.id) {
          console.log('Adding controls to task:', task.id, controlIds);
          await apiRequest(`/api/tasks/${task.id}/controls`, 'POST', { controlIds: controlIds.map(id => Number(id)) });
        }

        return task;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId] });
      handleClose();
    },
  });

  const handleControlToggle = (controlId: number) => {
    setSelectedControls(prev => 
      prev.includes(controlId) 
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
    // Update domain control counts when controls are toggled
    setTimeout(() => updateDomainControlCounts(), 0);
  };

  // Update domain control counts when controls are selected
  const updateDomainControlCounts = () => {
    if (!selectedDomain) return;
    
    const domainControlCount = selectedControls.filter(controlId => {
      const control = domainControls.find((pc: any) => pc.eccControl?.id === controlId);
      return control?.eccControl?.domainEn === selectedDomain;
    }).length;
    
    setDomainControlCounts(prev => ({
      ...prev,
      [selectedDomain]: domainControlCount
    }));
  };

  const handleNext = () => {
    if (step === 1 && !selectedProjectId) {
      return;
    }
    if (step === 2 && !selectedDomain) {
      return;
    }
    if (step === 3 && selectedControls.length === 0) {
      return;
    }
    
    // Update domain control counts when proceeding from step 2
    if (step === 2) {
      updateDomainControlCounts();
      
      // If controls are already selected, skip step 3 and go directly to step 4
      if (selectedControls.length > 0) {
        // Update form values - ensure controlIds are numbers
        form.setValue('controlIds', selectedControls.map(id => Number(id)));
        form.setValue('projectId', Number(selectedProjectId!));
        form.setValue('createSeparateTasks', createSeparateTasks);
        
        setStep(4); // Skip to step 4
        return;
      }
    }
    
    // Update form values - ensure controlIds are numbers
    form.setValue('controlIds', selectedControls.map(id => Number(id)));
    form.setValue('projectId', Number(selectedProjectId!));
    form.setValue('createSeparateTasks', createSeparateTasks);
    
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
    setStep(preselectedProjectId ? 2 : 1);
    setSelectedControls([]);
    setSelectedProjectId(preselectedProjectId || projectId || null);
    setSelectedDomain('');
    setDomainSearch('');
    setCreateSeparateTasks(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6">
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
              step === 3 ? 'bg-blue-600 text-white' : step > 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              3
            </div>
            <div className={`w-16 h-0.5 ${step >= 4 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              4
            </div>
          </div>

          {step === 1 && !preselectedProjectId && (
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
                  {language === 'ar' ? 'الخطوة 2: اختر النطاق' : 'Step 2: Select Domain'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'اختر النطاق الذي تريد إنشاء مهام له' 
                    : 'Select the domain you want to create tasks for'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Domain search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder={language === 'ar' ? 'بحث في النطاقات...' : 'Search domains...'}
                      value={domainSearch}
                      onChange={(e) => setDomainSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Domain selection */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredDomains.map((domain) => (
                      <div 
                        key={domain}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedDomain === domain
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedDomain(domain);
                          // Update domain control counts before proceeding
                          updateDomainControlCounts();
                          // Automatically go to step 3 (control selection) for this domain
                          setTimeout(() => {
                            setStep(3);
                          }, 100);
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            type="radio"
                            id={`domain-${domain}`}
                            name="domain"
                            checked={selectedDomain === domain}
                            onChange={() => {
                              setSelectedDomain(domain);
                              // Update domain control counts before proceeding
                              updateDomainControlCounts();
                              // Automatically go to step 3 (control selection) for this domain
                              setTimeout(() => {
                                setStep(3);
                              }, 100);
                            }}
                            className="h-4 w-4 text-blue-600"
                          />
                          <Label 
                            htmlFor={`domain-${domain}`}
                            className="text-sm font-medium cursor-pointer flex-1"
                          >
                            {domain}
                          </Label>
                          {domainControlCounts[domain] > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {domainControlCounts[domain]}
                            </Badge>
                          )}
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
                  {language === 'ar' ? 'الخطوة 3: اختر الضوابط وخيارات الإنشاء' : 'Step 3: Select Controls and Creation Options'}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'اختر الضوابط من النطاق المحدد وحدد خيارات إنشاء المهام' 
                    : 'Select controls from the chosen domain and specify task creation options'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Back to domain selection and Select All Controls button */}
                  <div className="flex justify-between items-center mb-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        // Update domain control counts before going back
                        updateDomainControlCounts();
                        setStep(2);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'العودة للنطاقات' : 'Back to Domains'}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const allControlIds = domainControls.map((pc: any) => pc.eccControl?.id).filter(Boolean);
                        if (selectedControls.length === allControlIds.length) {
                          // If all are selected, unselect all
                          setSelectedControls([]);
                        } else {
                          // Select all
                          setSelectedControls(allControlIds);
                        }
                      }}
                    >
                      {selectedControls.length === domainControls.length 
                        ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                        : (language === 'ar' ? 'تحديد الكل' : 'Select All')
                      }
                    </Button>
                  </div>

                  {/* Selected controls display */}
                  {selectedControls.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'الضوابط المختارة' : 'Selected Controls'} ({selectedControls.length})
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedControls.map(controlId => {
                          const control = domainControls.find((pc: any) => pc.eccControl?.id === controlId);
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
                  <div className="grid gap-3 max-h-64 overflow-y-auto">
                    {domainControls.map((projectControl: any) => (
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
                              ? projectControl.eccControl?.subdomainAr 
                              : projectControl.eccControl?.subdomainEn
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

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {language === 'ar' ? 'الخطوة 4: تفاصيل المهمة' : 'Step 4: Task Details'}
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
                        const control = domainControls.find((pc: any) => pc.eccControl?.id === controlId);
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

          {/* Navigation buttons for all steps */}
          {step < 4 && (
            <div className="flex justify-between mt-6">
              {step === 1 ? (
                <Button variant="outline" onClick={onClose}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              ) : step === 3 ? (
                <div /> // Spacer for step 3 since it has local back button
              ) : (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'السابق' : 'Back'}
                </Button>
              )}
              <div className="flex flex-col items-end">
                <Button 
                  onClick={handleNext}
                  disabled={
                    (step === 1 && !preselectedProjectId && !selectedProjectId) ||
                    (step === 2 && !selectedDomain) ||
                    (step === 3 && selectedControls.length === 0)
                  }
                >
                  {language === 'ar' ? 'التالي' : 'Next'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                {step === 3 && selectedControls.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {language === 'ar' ? 'اختر ضابط واحد على الأقل للمتابعة' : 'Select at least one control to continue'}
                  </p>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}