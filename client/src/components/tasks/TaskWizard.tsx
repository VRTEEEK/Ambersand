import { useState, useEffect } from 'react';
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
import { X, ArrowLeft, ArrowRight, Search, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';
import AssigneeSmartInput from '@/components/users/AssigneeSmartInput';

// Task creation schema
const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional().nullable().transform(val => val || null),
  assigneeId: z.string().optional().nullable().transform(val => val || null),
  assigneeEmail: z.string().optional(), // For new email invites
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
  preselectedControlId?: number; // For when opened from control card "Add Task" button
  onTaskCreated?: () => void; // Callback when task is successfully created
}

export default function TaskWizard({ isOpen, onClose, projectId, preselectedProjectId, preselectedControlId, onTaskCreated }: TaskWizardProps) {
  const { language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(() => {
    // Skip to step 3 if both project and control are preselected
    if (preselectedProjectId && preselectedControlId) return 3;
    // Skip to step 2 if only project is preselected
    if (preselectedProjectId) return 2;
    return 1;
  });
  const [selectedControls, setSelectedControls] = useState<number[]>(preselectedControlId ? [preselectedControlId] : []);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(preselectedProjectId || projectId || null);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [domainSearch, setDomainSearch] = useState('');
  const [createSeparateTasks, setCreateSeparateTasks] = useState(false);
  const [domainControlCounts, setDomainControlCounts] = useState<Record<string, number>>({});
  const [assigneeDisplay, setAssigneeDisplay] = useState<string>('');
  const [controlActiveTasks, setControlActiveTasks] = useState<Record<number, any[]>>({});
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

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

  // Clear selected controls when project changes (but preserve preselected control)
  useEffect(() => {
    if (selectedProjectId && !preselectedControlId) {
      setSelectedControls([]);
      setSelectedDomain('');
      setDomainControlCounts({});
    }
  }, [selectedProjectId, preselectedControlId]);

  // Fetch projects for selection (only if not preselected)
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isOpen && !preselectedProjectId,
  });

  // Fetch project controls
  const { data: projectControls = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${selectedProjectId}/controls`],
    enabled: isOpen && !!selectedProjectId,
  });

  // Reinitialize wizard state when opening with preselected control
  useEffect(() => {
    if (isOpen && preselectedControlId) {
      setSelectedControls([preselectedControlId]);
      setStep(() => {
        if (preselectedProjectId && preselectedControlId) return 3;
        if (preselectedProjectId) return 2;
        return 1;
      });
    }
  }, [isOpen, preselectedControlId, preselectedProjectId]);

  // Auto-detect domain from preselected control
  useEffect(() => {
    if (preselectedControlId && projectControls.length > 0) {
      const control = projectControls.find((pc: any) => {
        const ctrl = pc.control || pc.eccControl || pc.customControl;
        return ctrl?.id === preselectedControlId;
      });
      
      if (control) {
        const ctrl = control.control || control.eccControl || control.customControl;
        // Handle all control types: regulation controls, ECC controls, and custom controls
        const domain = ctrl?.mainCategoryEn || ctrl?.domainEn || ctrl?.mainDomain || ctrl?.domain || '';
        if (domain && domain !== selectedDomain) {
          setSelectedDomain(domain);
        }
      } else if (preselectedControlId) {
        // Preselected control not found - clear it and show error
        console.warn('Preselected control not found in project controls:', preselectedControlId);
        setSelectedControls([]);
      }
    }
  }, [preselectedControlId, projectControls, selectedDomain]);

  // Fetch users for assignee dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Get unique domains from project controls (handle regulation controls and legacy controls)
  const domains = Array.from(new Set(
    (projectControls as any[]).map((pc: any) => {
      const control = pc.control;
      if (!control) return null;

      // Handle new regulation controls (main_category_en/main_category_ar)
      if (control.mainCategoryEn || control.mainCategoryAr) {
        return language === 'ar' ? control.mainCategoryAr : control.mainCategoryEn;
      }

      // Handle legacy ECC controls (domainEn/domainAr)
      if (control.domainEn || control.domainAr) {
        return language === 'ar' ? control.domainAr : control.domainEn;
      }

      // Handle custom controls (mainDomain/mainDomainAr)
      if (control.mainDomain || control.mainDomainAr) {
        return language === 'ar' ? control.mainDomainAr || control.mainDomain : control.mainDomain;
      }

      return null;
    })
  )).filter(Boolean).sort();

  // Auto-select first domain if project is preselected and only one domain exists
  useEffect(() => {
    if (preselectedProjectId && domains && domains.length === 1 && !selectedDomain) {
      setSelectedDomain(domains[0] as string);
    }
  }, [preselectedProjectId, domains, selectedDomain]);

  // Filter domains based on search
  const filteredDomains = domains.filter((domain: any) =>
    (domain as string).toLowerCase().includes(domainSearch.toLowerCase())
  );

  // Get controls for selected domain (handle regulation controls and legacy controls)
  const domainControls = (projectControls as any[]).filter((pc: any) => {
    const control = pc.control;
    if (!control) return false;

    // Get domain based on control type
    let controlDomain;
    if (language === 'ar') {
      controlDomain = control.mainCategoryAr || control.domainAr || control.mainDomainAr || control.mainDomain;
    } else {
      controlDomain = control.mainCategoryEn || control.domainEn || control.mainDomain;
    }

    return controlDomain === selectedDomain;
  });

  // Fetch active tasks for controls when domain controls change
  useEffect(() => {
    const fetchActiveTasks = async () => {
      if (!selectedProjectId || domainControls.length === 0) {
        console.log('🔍 Active Tasks: Clearing (no project or controls)');
        setControlActiveTasks({});
        return;
      }

      const controlIds = domainControls.map((pc: any) => pc.control?.id).filter(Boolean);
      console.log('🔍 Active Tasks: Fetching for controls:', controlIds);

      if (controlIds.length === 0) return;

      try {
        const response = await apiRequest('/api/controls/active-tasks', 'POST', {
          controlIds,
          projectId: selectedProjectId
        });

        // Check if response is ok
        if (!response.ok) {
          const status = response.status;
          console.error(`❌ Active Tasks: API returned status ${status}`);
          if (status === 401) {
            console.error('❌ Active Tasks: Unauthorized - session may have expired');
            // Optionally redirect to login
            // window.location.href = '/login';
          }
          setControlActiveTasks({});
          return;
        }

        const data = await response.json();
        console.log('✅ Active Tasks: Received data:', data);
        console.log('📊 Active Tasks Summary:', Object.entries(data).map(([id, tasks]) => `Control ${id}: ${(tasks as any[]).length} tasks`));
        setControlActiveTasks(data);
      } catch (error) {
        console.error('❌ Error fetching active tasks for controls:', error);
        setControlActiveTasks({});
      }
    };

    fetchActiveTasks();
  }, [selectedProjectId, domainControls.length, selectedDomain]);

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { controlIds, createSeparateTasks, ...taskData } = data;
      
      // Clean up the task data - convert empty strings to null/undefined
      const cleanTaskData = {
        ...taskData,
        dueDate: taskData.dueDate || undefined,
        assigneeId: taskData.assigneeId || undefined,
        projectId: Number(taskData.projectId),
      };
      
      if (createSeparateTasks && controlIds.length > 1) {
        // Create separate tasks for each control
        const tasks = [];
        for (const controlId of controlIds) {
          const control = domainControls.find((pc: any) => pc.control?.id === controlId);
          const controlTitle = language === 'ar' 
            ? (control?.control?.controlAr || control?.control?.control)
            : (control?.control?.controlEn || control?.control?.control);
          
          const taskResponse = await apiRequest('/api/tasks', 'POST', {
            ...cleanTaskData,
            title: `${cleanTaskData.title} - ${control?.control?.clause || control?.control?.code}`,
            titleAr: cleanTaskData.titleAr ? `${cleanTaskData.titleAr} - ${control?.control?.clause || control?.control?.code}` : '',
            description: cleanTaskData.description ? `${cleanTaskData.description}\n\nControl: ${controlTitle}` : `Control: ${controlTitle}`,
            controlIds: [Number(controlId)]
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
        // Create single task with multiple controls - include controlIds in the request
        const taskWithControls = {
          ...cleanTaskData,
          controlIds: controlIds.map(id => Number(id))
        };
        
        console.log('📝 Sending task data to server:', taskWithControls);
        const taskResponse = await apiRequest('/api/tasks', 'POST', taskWithControls);
        const task = await taskResponse.json();
        console.log('Created task:', task);

        return task;
      }
    },
    onSuccess: (data) => {
      console.log('✅ TaskWizard: Task creation successful, invalidating cache...', { data, selectedProjectId });
      
      // CRITICAL: Close dialog FIRST before any other operations
      console.log('🔄 TaskWizard: IMMEDIATELY closing dialog');
      handleClose();
      
      // CRITICAL: Call the parent callback to trigger immediate refresh
      if (onTaskCreated) {
        console.log('🔄 TaskWizard: Calling onTaskCreated callback');
        onTaskCreated();
      }
      
      // Show success toast to user
      if (typeof window !== 'undefined' && window.location) {
        console.log('✅ TaskWizard: Showing success notification');
      }
      
      // Invalidate all task-related queries with comprehensive patterns
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          const match = typeof key === 'string' && key.startsWith('/api/tasks');
          if (match) {
            console.log('🔄 TaskWizard: Invalidating task query:', query.queryKey);
          }
          return match;
        }
      });
      
      // Specifically invalidate project detail task queries
      if (selectedProjectId) {
        // Try different project ID formats (string and number)
        const projectIdStr = String(selectedProjectId);
        const projectIdNum = Number(selectedProjectId);
        
        // CRITICAL: Invalidate queries that match the ProjectDetail query pattern
        // ProjectDetail uses: ['/api/tasks', { projectId: id }, refreshKey]
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            // Check if this is a task query with projectId parameter
            const isTaskQuery = Array.isArray(key) && 
              key[0] === '/api/tasks' &&
              key[1] && 
              typeof key[1] === 'object' &&
              'projectId' in key[1];
            
            if (isTaskQuery) {
              const queryProjectId = key[1].projectId;
              const matches = queryProjectId == selectedProjectId || 
                             queryProjectId == projectIdStr || 
                             queryProjectId == projectIdNum;
              if (matches) {
                console.log('🔄 TaskWizard: Invalidating project task query:', query.queryKey);
                return true;
              }
            }
            
            // Also check for with-controls queries: ['/api/tasks', projectId, 'with-controls', refreshKey]
            const isWithControlsQuery = Array.isArray(key) && 
              key[0] === '/api/tasks' &&
              key[2] === 'with-controls';
            
            if (isWithControlsQuery) {
              const queryProjectId = key[1];
              const matches = queryProjectId == selectedProjectId || 
                             queryProjectId == projectIdStr || 
                             queryProjectId == projectIdNum;
              if (matches) {
                console.log('🔄 TaskWizard: Invalidating project task query:', query.queryKey);
                return true;
              }
            }
            
            return false;
          }
        });
      }
      
      // Invalidate project-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProjectId] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          const match = Array.isArray(key) && key[0] === '/api/projects' && key[1] === selectedProjectId;
          if (match) {
            console.log('🔄 TaskWizard: Invalidating project query:', query.queryKey);
          }
          return match;
        }
      });
      
      // Force a manual refetch of all task and project queries
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (key.startsWith('/api/tasks') || key.startsWith('/api/projects'));
        }
      });
      
      // Also trigger a refresh on the page by incrementing refresh keys
      if (typeof window !== 'undefined') {
        // Dispatch a custom event to trigger refresh on ProjectDetail
        window.dispatchEvent(new CustomEvent('taskCreated', { 
          detail: { taskId: data.data.id, projectId: selectedProjectId } 
        }));
      }
      
      console.log('✅ TaskWizard: Cache invalidation complete');
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
      return Boolean(domainControls.find(pc => pc.control?.id === controlId));
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
    console.log('📝 TaskWizard: Form submitted with data:', data);
    console.log('📝 TaskWizard: Selected controls:', selectedControls);
    console.log('📝 TaskWizard: Selected project ID:', selectedProjectId);
    
    // Ensure we have the required data
    if (!selectedProjectId) {
      console.error('❌ No project selected');
      return;
    }
    
    if (selectedControls.length === 0) {
      console.error('❌ No controls selected');
      return;
    }
    
    // Combine form data with selected controls and project
    const submitData = {
      ...data,
      projectId: selectedProjectId,
      controlIds: selectedControls,
    };
    
    console.log('📝 TaskWizard: Submitting task with data:', submitData);
    createTaskMutation.mutate(submitData);
  };

  const handleClose = () => {
    console.log('🔄 TaskWizard: handleClose called');
    
    // Reset all states first
    form.reset();
    setStep(preselectedProjectId ? 2 : 1);
    setSelectedControls([]);
    setSelectedProjectId(preselectedProjectId || projectId || null);
    setSelectedDomain('');
    setDomainSearch('');
    setCreateSeparateTasks(false);
    
    // Then call the parent's onClose
    if (typeof onClose === 'function') {
      console.log('🔄 TaskWizard: Calling parent onClose');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('🔄 TaskWizard: Dialog onOpenChange triggered with:', open);
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent className="max-w-4xl h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ar' ? 'اتبع الخطوات لإنشاء مهمة جديدة وتعيينها للفريق' : 'Follow the steps to create a new task and assign it to your team'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            {!preselectedProjectId && (
              <>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step === 1 ? 'bg-blue-600 text-white' : step > 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  1
                </div>
                <div className={`w-16 h-0.5 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </>
            )}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 2 ? 'bg-blue-600 text-white' : step > 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {preselectedProjectId ? '1' : '2'}
            </div>
            <div className={`w-16 h-0.5 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 3 ? 'bg-blue-600 text-white' : step > 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {preselectedProjectId ? '2' : '3'}
            </div>
            <div className={`w-16 h-0.5 ${step >= 4 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step === 4 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {preselectedProjectId ? '3' : '4'}
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
                  {(projects as any[]).map((project: any) => (
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
                  {preselectedProjectId 
                    ? (language === 'ar' ? 'الخطوة 1: اختر النطاق' : 'Step 1: Select Domain')
                    : (language === 'ar' ? 'الخطوة 2: اختر النطاق' : 'Step 2: Select Domain')}
                </CardTitle>
                <CardDescription>
                  {preselectedProjectId ? (
                    language === 'ar' 
                      ? 'اختر النطاق الذي تريد إنشاء مهام له من المشروع المحدد' 
                      : 'Select the domain you want to create tasks for from the selected project'
                  ) : (
                    language === 'ar' 
                      ? 'اختر النطاق الذي تريد إنشاء مهام له' 
                      : 'Select the domain you want to create tasks for'
                  )}
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
                    {filteredDomains.map((domain: any) => (
                      <div 
                        key={domain as string}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedDomain === domain
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          setSelectedDomain(domain as string);
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
                              setSelectedDomain(domain as string);
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
                            {domain as string}
                          </Label>
                          {domainControlCounts[domain as string] > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {domainControlCounts[domain as string]}
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
                  {preselectedProjectId 
                    ? (language === 'ar' ? 'الخطوة 2: اختر الضوابط وخيارات الإنشاء' : 'Step 2: Select Controls and Creation Options')
                    : (language === 'ar' ? 'الخطوة 3: اختر الضوابط وخيارات الإنشاء' : 'Step 3: Select Controls and Creation Options')}
                </CardTitle>
                <CardDescription>
                  {language === 'ar' 
                    ? 'اختر الضوابط من النطاق المحدد وحدد خيارات إنشاء المهام' 
                    : 'Select controls from the chosen domain and specify task creation options'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Back to domain selection and Actions bar */}
                  <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
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

                    <div className="flex items-center gap-2">
                      {/* Filter Toggle */}
                      <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-gray-50 dark:bg-gray-800">
                        <Switch
                          id="show-available"
                          checked={showOnlyAvailable}
                          onCheckedChange={setShowOnlyAvailable}
                        />
                        <Label
                          htmlFor="show-available"
                          className="text-xs cursor-pointer whitespace-nowrap"
                        >
                          {language === 'ar' ? 'فقط بدون مهام' : 'Only without tasks'}
                        </Label>
                      </div>

                      {/* Select All Button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allControlIds = domainControls
                            .filter((pc: any) => {
                              if (!showOnlyAvailable) return true;
                              const controlId = pc.control?.id;
                              const activeTasks = controlActiveTasks[controlId] || [];
                              return activeTasks.length === 0;
                            })
                            .map((pc: any) => pc.control?.id)
                            .filter(Boolean);

                          if (selectedControls.length === allControlIds.length) {
                            // If all are selected, unselect all
                            setSelectedControls([]);
                          } else {
                            // Select all (visible controls only)
                            setSelectedControls(allControlIds);
                          }
                        }}
                      >
                        {selectedControls.length === domainControls.filter((pc: any) => {
                          if (!showOnlyAvailable) return true;
                          const controlId = pc.control?.id;
                          const activeTasks = controlActiveTasks[controlId] || [];
                          return activeTasks.length === 0;
                        }).length
                          ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                          : (language === 'ar' ? 'تحديد الكل' : 'Select All')
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Selected controls display */}
                  {selectedControls.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-sm font-medium">
                        {language === 'ar' ? 'الضوابط المختارة' : 'Selected Controls'} ({selectedControls.length})
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedControls.map(controlId => {
                          const control = (projectControls as any[]).find((pc: any) => pc.control?.id === controlId);
                          return (
                            <Badge key={controlId} variant="secondary" className="flex items-center gap-1">
                              {control?.control?.clause || control?.control?.code || controlId}
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
                    {domainControls
                      .filter((pc: any) => {
                        // Apply "show only available" filter
                        if (!showOnlyAvailable) return true;
                        const controlId = pc.control?.id;
                        const activeTasks = controlActiveTasks[controlId] || [];
                        return activeTasks.length === 0;
                      })
                      .map((projectControl: any) => {
                        const controlId = projectControl.control?.id;
                        const activeTasks = controlActiveTasks[controlId] || [];
                        const hasActiveTasks = activeTasks.length > 0;

                        // Debug logging for each control
                        if (controlId && activeTasks.length > 0) {
                          console.log(`🎨 Control ${controlId}: ${activeTasks.length} active tasks, hasActiveTasks=${hasActiveTasks}`);
                        }

                        return (
                        <div
                          key={projectControl.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg transition-all ${
                            hasActiveTasks
                              ? 'border-2 border-orange-400 bg-orange-50 dark:border-orange-500 dark:bg-orange-900/20'
                              : 'border border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <Checkbox
                            id={`control-${controlId}`}
                            checked={selectedControls.includes(controlId)}
                            onCheckedChange={() => handleControlToggle(controlId)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor={`control-${controlId}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {projectControl.control?.clause} - {
                                  language === 'ar'
                                    ? (projectControl.control?.mainControlAr || projectControl.control?.controlAr || projectControl.control?.control)
                                    : (projectControl.control?.mainControlEn || projectControl.control?.controlEn || projectControl.control?.control)
                                }
                              </Label>
                              {hasActiveTasks && (
                                <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {activeTasks.length} {language === 'ar' ? 'مهمة نشطة' : 'active task(s)'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {language === 'ar'
                                ? (projectControl.control?.subCategoryAr || projectControl.control?.subdomainAr || projectControl.control?.subDomainAr)
                                : (projectControl.control?.subCategoryEn || projectControl.control?.subdomainEn || projectControl.control?.subDomain)
                              }
                            </p>
                            {hasActiveTasks && (
                              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                <p className="font-medium mb-1">
                                  {language === 'ar' ? 'المهام النشطة:' : 'Active tasks:'}
                                </p>
                                <ul className="space-y-1">
                                  {activeTasks.slice(0, 2).map((task: any) => (
                                    <li key={task.id} className="flex items-center gap-2">
                                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                      <span className="truncate">{task.title}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {task.status}
                                      </Badge>
                                    </li>
                                  ))}
                                  {activeTasks.length > 2 && (
                                    <li className="text-xs text-gray-500">
                                      {language === 'ar'
                                        ? `+${activeTasks.length - 2} مهام أخرى`
                                        : `+${activeTasks.length - 2} more task(s)`}
                                    </li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* No controls message when filtered */}
                    {domainControls.filter((pc: any) => {
                      if (!showOnlyAvailable) return true;
                      const controlId = pc.control?.id;
                      const activeTasks = controlActiveTasks[controlId] || [];
                      return activeTasks.length === 0;
                    }).length === 0 && showOnlyAvailable && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">
                          {language === 'ar'
                            ? 'جميع الضوابط في هذا النطاق لديها مهام نشطة'
                            : 'All controls in this domain have active tasks'}
                        </p>
                        <p className="text-xs mt-1">
                          {language === 'ar'
                            ? 'قم بإيقاف الفلتر لرؤية جميع الضوابط'
                            : 'Turn off the filter to see all controls'}
                        </p>
                      </div>
                    )}
                  </div>


                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {preselectedProjectId 
                    ? (language === 'ar' ? 'الخطوة 3: تفاصيل المهمة' : 'Step 3: Task Details')
                    : (language === 'ar' ? 'الخطوة 4: تفاصيل المهمة' : 'Step 4: Task Details')}
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
                      <Label htmlFor="assignee">{language === 'ar' ? 'المكلف' : 'Assignee'}</Label>
                      <AssigneeSmartInput
                        onResolve={(r) => {
                          if (r.type === "existing") {
                            form.setValue("assigneeId", r.userId);      // string
                            form.setValue("assigneeEmail", undefined);  // undefined, not empty string
                            setAssigneeDisplay(r.name || r.email);
                          } else {
                            form.setValue("assigneeId", null);
                            form.setValue("assigneeEmail", r.email);    // only email
                            setAssigneeDisplay(`${r.email} (invited)`);
                            toast({ 
                              title: "Invitation sent",
                              description: `Invitation sent to ${r.email}.`
                            });
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Selected controls summary */}
                  <div>
                    <Label>{language === 'ar' ? 'الضوابط المختارة' : 'Selected Controls'}</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedControls.map(controlId => {
                        const control = (projectControls as any[]).find((pc: any) => pc.control?.id === controlId);
                        return (
                          <Badge key={controlId} variant="secondary">
                            {control?.control?.clause || control?.control?.code || controlId}
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