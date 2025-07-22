import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ChevronDown,
  FileText,
  Target,
  X,
  MessageSquare,
  History,
  Plus
} from 'lucide-react';

interface EditTaskFormProps {
  task: any;
  projectControls: any[];
  taskEvidence: any[];
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  language: string;
}

// ControlSelector Component
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
  onControlClick: (control: any) => void;
}) {
  const [selectedControls, setSelectedControls] = useState<number[]>([]);

  const handleControlToggle = (controlId: number) => {
    setSelectedControls(prev => 
      prev.includes(controlId) 
        ? prev.filter(id => id !== controlId)
        : [...prev, controlId]
    );
  };

  const handleAddSelected = () => {
    if (selectedControls.length > 0) {
      onAddControls(selectedControls);
      setSelectedControls([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-h-60 overflow-y-auto space-y-2">
        {controls.map((control: any) => (
          <div key={control.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <input
              type="checkbox"
              checked={selectedControls.includes(control.eccControl.id)}
              onChange={() => handleControlToggle(control.eccControl.id)}
              className="mt-2"
            />
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => onControlClick(control.eccControl)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {control.eccControl.code}
                </Badge>
                <span className="text-sm font-medium">
                  {language === 'ar' && control.eccControl.subdomainAr 
                    ? control.eccControl.subdomainAr 
                    : control.eccControl.subdomainEn}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {language === 'ar' && control.eccControl.controlAr 
                  ? control.eccControl.controlAr 
                  : control.eccControl.controlEn}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {selectedControls.length > 0 && (
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {selectedControls.length} {language === 'ar' ? 'ضابط محدد' : 'controls selected'}
          </span>
          <Button 
            onClick={handleAddSelected}
            disabled={isLoading}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {language === 'ar' ? 'إضافة المحددة' : 'Add Selected'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function EditTaskForm({ 
  task, 
  projectControls, 
  taskEvidence,
  onSubmit, 
  onCancel, 
  isLoading, 
  language 
}: EditTaskFormProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'controls' | 'evidence'>('details');
  const [uploadComment, setUploadComment] = useState('');
  const [selectedControlForView, setSelectedControlForView] = useState<number | null>(null);
  const [showEvidenceForControl, setShowEvidenceForControl] = useState<boolean>(false);
  const [evidenceAttachMode, setEvidenceAttachMode] = useState<'upload' | 'link' | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [hasAutoSelectedControl, setHasAutoSelectedControl] = useState(false);
  const [selectedControlForInfo, setSelectedControlForInfo] = useState<any>(null);
  const [isControlInfoDialogOpen, setIsControlInfoDialogOpen] = useState(false);
  const [pendingRemovedControls, setPendingRemovedControls] = useState<number[]>([]);
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

  // Fetch task controls
  const { data: taskControls } = useQuery({
    queryKey: ['/api/tasks', task.id, 'controls'],
    enabled: !!task.id,
  });

  // Fetch all users for assignee dropdown
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

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
  const filteredTaskControls = taskControls?.filter(
    (control: any) => !pendingRemovedControls.includes(control.eccControl.id)
  );

  // Fetch evidence linked to specific control
  const { data: controlLinkedEvidence } = useQuery({
    queryKey: ['/api/evidence', 'control', selectedControlForView],
    enabled: !!selectedControlForView,
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

  const handleControlClick = (control: any) => {
    setSelectedControlForInfo(control);
    setIsControlInfoDialogOpen(true);
  };

  // Get unique domains from project controls
  const domains = Array.from(new Set(
    projectControls.map((pc: any) => pc.eccControl?.domainEn).filter(Boolean)
  ));

  // Get controls for selected domain that are NOT already assigned to the task
  const domainControls = selectedDomain 
    ? projectControls.filter((pc: any) => {
        const isInDomain = pc.eccControl?.domainEn === selectedDomain;
        const isAlreadyAssigned = taskControls?.some((tc: any) => tc.eccControl?.id === pc.eccControl?.id);
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
    setPendingRemovedControls(prev => [...prev, controlId]);
  };

  // Handle restoring temporarily removed control
  const handleRestoreControl = (controlId: number) => {
    setPendingRemovedControls(prev => prev.filter(id => id !== controlId));
  };

  return (
    <div className="space-y-6">
      {/* Three-Tab Interface */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'details' | 'controls' | 'evidence')}>
        <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
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
                        {control.eccControl.code}
                      </Badge>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {language === 'ar' && control.eccControl.subdomainAr 
                            ? control.eccControl.subdomainAr 
                            : control.eccControl.subdomainEn}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'ar' && control.eccControl.controlAr 
                            ? control.eccControl.controlAr 
                            : control.eccControl.controlEn}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleTemporaryRemoveControl(control.eccControl.id)}
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
                          {projectControls.filter(pc => pc.eccControl?.domainEn === domain && !taskControls?.some(tc => tc.eccControl?.id === pc.eccControl?.id)).length} available
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

        {/* Tab 3: Evidence */}
        <TabsContent value="evidence" className="space-y-4">
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">
              {language === 'ar' ? 'إدارة الأدلة متاحة في صفحة تفاصيل المشروع' : 'Evidence management available in project detail page'}
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          {language === 'ar' ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button 
          onClick={handleTaskSubmit}
          disabled={isLoading}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {isLoading ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
        </Button>
      </div>
    </div>
  );
}