import { useState, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/use-i18n';
import { useToast } from '@/hooks/use-toast';

// ------------------ SCHEMA ------------------
const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  titleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  projectId: z.number(),
  controlIds: z.array(z.number()).min(1, 'Select at least one control'),
  createSeparateTasks: z.boolean().default(false),
});

type TaskFormData = z.infer<typeof taskSchema>;
interface TaskWizardProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: number;
  preselectedProjectId?: number;
}

// ------------------ HELPER COMPONENTS ------------------
const StepIndicator = ({ step, preselected }: { step: number; preselected?: boolean }) => {
  const steps = preselected
    ? ['1', '2', '3']
    : ['1', '2', '3', '4'];

  return (
    <div className="flex items-center justify-center space-x-4 mb-6">
      {steps.map((num, idx) => (
        <div key={num} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full 
            ${step === idx + 1 ? 'bg-blue-600 text-white' :
              step > idx + 1 ? 'bg-green-600 text-white' :
              'bg-gray-200 text-gray-600'}`}>
            {num}
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-16 h-0.5 ${step >= idx + 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

// ------------------ MAIN ------------------
export default function TaskWizard({ isOpen, onClose, projectId, preselectedProjectId }: TaskWizardProps) {
  const { language } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(preselectedProjectId ? 2 : 1);
  const [selectedControls, setSelectedControls] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(preselectedProjectId || projectId || null);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [domainSearch, setDomainSearch] = useState('');
  const [createSeparateTasks, setCreateSeparateTasks] = useState(false);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      priority: 'medium',
      projectId: selectedProjectId || undefined,
      controlIds: [],
      createSeparateTasks: false,
    },
  });

  // ----------- FETCH DATA -----------
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isOpen && !preselectedProjectId,
  });

  const { data: projectControls = [] } = useQuery({
    queryKey: ['/api/projects', selectedProjectId, 'controls'],
    enabled: isOpen && !!selectedProjectId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // ----------- DERIVED DATA -----------
  const domains = Array.from(new Set(
    (projectControls as any[]).map((pc: any) => language === 'ar' ? pc.eccControl?.domainAr : pc.eccControl?.domainEn)
  )).filter(Boolean).sort();

  const filteredDomains = domains.filter((domain: any) =>
    domain.toLowerCase().includes(domainSearch.toLowerCase())
  );

  const domainControls = (projectControls as any[]).filter((pc: any) => {
    const controlDomain = language === 'ar' ? pc.eccControl?.domainAr : pc.eccControl?.domainEn;
    return controlDomain === selectedDomain;
  });

  // ----------- EFFECTS -----------
  useEffect(() => {
    if (preselectedProjectId && domains.length === 1 && !selectedDomain) {
      setSelectedDomain(domains[0] as string);
    }
  }, [domains, preselectedProjectId, selectedDomain]);

  // ----------- HANDLERS -----------
  const handleControlToggle = (controlId: number) => {
    setSelectedControls(prev =>
      prev.includes(controlId)
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const handleNext = () => {
    if ((step === 1 && !selectedProjectId) ||
        (step === 2 && !selectedDomain) ||
        (step === 3 && selectedControls.length === 0)) return;
    form.setValue('controlIds', selectedControls);
    form.setValue('projectId', Number(selectedProjectId));
    form.setValue('createSeparateTasks', createSeparateTasks);
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleClose = () => {
    onClose();
    form.reset();
    setStep(preselectedProjectId ? 2 : 1);
    setSelectedControls([]);
    setSelectedDomain('');
    setDomainSearch('');
    setCreateSeparateTasks(false);
  };

  // ----------- API CALL -----------
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const { controlIds, createSeparateTasks, ...taskData } = data;
      const cleanData = { ...taskData, projectId: Number(taskData.projectId) };

      if (createSeparateTasks && controlIds.length > 1) {
        return Promise.all(controlIds.map(async id => {
          const task = await (await apiRequest('/api/tasks', 'POST', { ...cleanData, title: `${taskData.title} - ${id}` })).json();
          if (task.id) await apiRequest(`/api/tasks/${task.id}/controls`, 'POST', { controlIds: [id] });
          return task;
        }));
      } else {
        const task = await (await apiRequest('/api/tasks', 'POST', cleanData)).json();
        if (task.id) await apiRequest(`/api/tasks/${task.id}/controls`, 'POST', { controlIds });
        return task;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => {
        const k = q.queryKey[0];
        return typeof k === 'string' && (k.startsWith('/api/tasks') || k.startsWith('/api/projects'));
      }});
      toast({ title: language === 'ar' ? 'تم إنشاء المهمة' : 'Task Created' });
      handleClose();
    },
    onError: () => {
      toast({
        title: language === 'ar' ? 'خطأ في إنشاء المهمة' : 'Task Creation Failed',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: TaskFormData) => createTaskMutation.mutate(data);

  // ------------------ UI RENDER ------------------
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[700px] flex flex-col">
        <DialogHeader><DialogTitle>{language === 'ar' ? 'إنشاء مهمة جديدة' : 'Create New Task'}</DialogTitle></DialogHeader>

        <StepIndicator step={step} preselected={!!preselectedProjectId} />

        {/* STEP CONTENTS */}
        {/* Step 1 - Project Selection */}
        {step === 1 && !preselectedProjectId && (
          <Card>
            <CardHeader><CardTitle>{language === 'ar' ? 'اختر المشروع' : 'Select Project'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {projects.map((p: any) => (
                <div key={p.id} className={`p-4 border rounded-lg cursor-pointer ${selectedProjectId === p.id ? 'border-blue-600 bg-blue-50' : ''}`}
                  onClick={() => setSelectedProjectId(p.id)}>
                  <Label>{language === 'ar' ? p.nameAr : p.name}</Label>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2 - Domain Selection */}
        {step === (preselectedProjectId ? 1 : 2) && (
          <Card>
            <CardHeader><CardTitle>{language === 'ar' ? 'اختر النطاق' : 'Select Domain'}</CardTitle></CardHeader>
            <CardContent>
              <Input placeholder={language === 'ar' ? 'بحث...' : 'Search...'} value={domainSearch} onChange={(e: any) => setDomainSearch(e.target.value)} />
              <div className="space-y-3 mt-3 max-h-96 overflow-y-auto">
                {filteredDomains.map((domain: any) => (
                  <div key={domain} className={`p-4 border rounded-lg cursor-pointer ${selectedDomain === domain ? 'border-blue-600 bg-blue-50' : ''}`}
                    onClick={() => { setSelectedDomain(domain as string); setStep(s => s + 1); }}>
                    <Label>{domain}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 - Controls */}
        {step === (preselectedProjectId ? 2 : 3) && (
          <Card>
            <CardHeader><CardTitle>{language === 'ar' ? 'اختر الضوابط' : 'Select Controls'}</CardTitle></CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" onClick={() => setSelectedControls(domainControls.map((c: any) => c.eccControl?.id))}>
                {language === 'ar' ? 'تحديد الكل' : 'Select All'}
              </Button>
              <div className="grid gap-3 mt-3 max-h-64 overflow-y-auto">
                {domainControls.map((c: any) => (
                  <div key={c.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox checked={selectedControls.includes(c.eccControl?.id)} onCheckedChange={() => handleControlToggle(c.eccControl?.id)} />
                    <Label>{c.eccControl?.code} - {language === 'ar' ? c.eccControl?.controlAr : c.eccControl?.controlEn}</Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4 - Details */}
        {step === (preselectedProjectId ? 3 : 4) && (
          <Card>
            <CardHeader><CardTitle>{language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Input {...form.register('title')} placeholder="Title" />
                <Textarea {...form.register('description')} placeholder="Description" />
                <Select value={form.watch('priority')} onValueChange={val => form.setValue('priority', val as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* NAVIGATION */}
        <div className="flex justify-between mt-4">
          {step > 1 && <Button variant="outline" onClick={handleBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>}
          {step < (preselectedProjectId ? 3 : 4) && <Button onClick={handleNext}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}