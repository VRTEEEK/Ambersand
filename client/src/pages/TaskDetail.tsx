import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Flag, Clock, FileText, Upload, Download, MessageSquare, X, Plus, Grid, List } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/use-i18n";
import { apiRequest } from "@/lib/queryClient";
import AppLayout from "@/components/layout/AppLayout";
import type { Task, User as UserType, ProjectControl, Evidence, EvidenceVersion } from "@shared/schema";

interface TaskWithDetails extends Task {
  project?: { id: number; name: string; nameAr: string };
  assignee?: UserType;
  createdBy?: UserType;
}

export default function TaskDetail() {
  const { id: taskId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { language } = useI18n();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [linkExistingDialogOpen, setLinkExistingDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [selectedControlForView, setSelectedControlForView] = useState<number | null>(null);
  const [showEvidenceForControl, setShowEvidenceForControl] = useState(false);
  const [controlsViewMode, setControlsViewMode] = useState<'cards' | 'list'>('cards');
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    file: null as File | null
  });

  // Get current user
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/user"]
  });

  // Get task details
  const { data: task, isLoading: taskLoading } = useQuery<TaskWithDetails>({
    queryKey: ["/api/tasks", taskId],
    enabled: !!taskId
  });

  // Get all projects to find the task's project
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: !!task?.projectId
  });

  // Get all users to find assignee and creator
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    enabled: !!task
  });

  // Get task controls with ECC control details
  const { data: controls = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks", taskId, "controls"],
    enabled: !!taskId
  });

  // Get evidence for this task
  const { data: evidence = [] } = useQuery<Evidence[]>({
    queryKey: ["/api/evidence/task", taskId],
    enabled: !!taskId
  });

  // Get evidence versions
  const { data: versions = [] } = useQuery<EvidenceVersion[]>({
    queryKey: ["/api/evidence/versions", taskId],
    enabled: !!taskId
  });

  // Get evidence linked to specific control
  const { data: controlLinkedEvidence = [] } = useQuery<Evidence[]>({
    queryKey: ["/api/evidence/control", selectedControlForView],
    enabled: !!selectedControlForView
  });

  // Get all evidence for linking
  const { data: allEvidence = [] } = useQuery<Evidence[]>({
    queryKey: ["/api/evidence"]
  });

  // Auto-select first control when controls are loaded
  useEffect(() => {
    if (controls.length > 0 && !selectedControlId) {
      const firstControl = controls[0];
      if (firstControl?.eccControl?.id) {
        setSelectedControlId(firstControl.eccControl.id);
        setSelectedControlForView(firstControl.eccControl.id);
      }
    }
  }, [controls, selectedControlId]);

  // Calculate derived data
  const taskProject = projects.find((p: any) => p.id === task?.projectId);
  const assignedUser = users.find((u: any) => u.id === task?.assigneeId);
  const createdByUser = users.find((u: any) => u.id === task?.createdById);



  // Upload evidence mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/evidence`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error('Failed to upload evidence');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Evidence uploaded successfully"
      });
      setUploadDialogOpen(false);
      setUploadForm({ title: "", description: "", file: null });
      queryClient.invalidateQueries({ queryKey: ["/api/evidence/task", taskId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload evidence",
        variant: "destructive"
      });
    }
  });

  if (!taskId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Invalid task ID</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (taskLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading task details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Task not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user can upload evidence (assigned to task or admin/manager)
  const canUploadEvidence = currentUser && (
    task.assigneeId === currentUser.id ||
    currentUser.role === "admin" ||
    currentUser.role === "manager"
  );

  const handleFileUpload = async () => {
    if (!uploadForm.file || !uploadForm.title.trim()) {
      toast({
        title: "Error",
        description: "Please provide a title and select a file",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append("title", uploadForm.title);
    formData.append("description", uploadForm.description);
    formData.append("file", uploadForm.file);
    formData.append("taskId", taskId);
    formData.append("projectId", task.projectId?.toString() || "");

    uploadMutation.mutate(formData);
  };

  // Handle linking existing evidence to the selected control
  const handleLinkExistingEvidence = async (evidenceId: number) => {
    if (!selectedControlId) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يجب اختيار ضابط أولاً' : 'Please select a control first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await apiRequest(`/api/evidence/${evidenceId}/controls`, 'POST', { 
        controlIds: [selectedControlId] 
      });

      // Refresh the control linked evidence
      queryClient.invalidateQueries({ queryKey: ['/api/evidence/control', selectedControlId] });
      
      toast({
        title: language === 'ar' ? 'تم الربط بنجاح' : 'Linked Successfully',
        description: language === 'ar' ? 'تم ربط الدليل بالضابط بنجاح' : 'Evidence linked to control successfully',
      });

      // Close the dialog
      setLinkExistingDialogOpen(false);
    } catch (error) {
      console.error('Error linking evidence:', error);
      toast({
        title: language === 'ar' ? 'خطأ في الربط' : 'Link Error',
        description: language === 'ar' ? 'فشل في ربط الدليل' : 'Failed to link evidence',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in-progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => setLocation("/my-tasks")}
          className="mb-4"
        >
{language === 'ar' ? 'العودة للمهام ←' : '← Back to Tasks'}
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{task.title}</h1>
            {task.titleAr && (
              <h2 className="text-xl text-muted-foreground mt-1" dir="rtl">{task.titleAr}</h2>
            )}
          </div>
          <div className="flex gap-2">
            <Badge className={getPriorityColor(task.priority)}>
              {task.priority}
            </Badge>
            <Badge className={getStatusColor(task.status)}>
              {task.status}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            {language === 'ar' ? `الضوابط (${controls.length})` : `Controls (${controls.length})`}
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            {language === 'ar' ? 'الأدلة' : 'Evidence'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'معلومات المهمة' : 'Task Information'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Title */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold">{task.title}</h2>
                  
                </div>
                {task.titleAr && (
                  <h3 className="text-lg text-muted-foreground mb-4" dir="rtl">{task.titleAr}</h3>
                )}
              </div>

              {/* Task Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Project</label>
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 bg-teal-600 rounded-sm" />
                      <span className="font-medium">{taskProject?.name || "Unknown Project"}</span>
                    </div>
                    {taskProject?.nameAr && (
                      <p className="text-sm text-muted-foreground" dir="rtl">{taskProject.nameAr}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Assigned to</label>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{assignedUser ? `${assignedUser.firstName || ''} ${assignedUser.lastName || ''}`.trim() || assignedUser.email : "Unassigned"}</span>
                    </div>
                    {assignedUser?.email && (
                      <p className="text-xs text-muted-foreground">{assignedUser.email}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{task.dueDate ? format(new Date(task.dueDate), "PPP") : "Not set"}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{task.createdAt ? format(new Date(task.createdAt), "PPP") : "Unknown"}</span>
                    </div>
                  </div>
                  
                  {task.completedAt && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Completed</label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-green-600" />
                        <span>{format(new Date(task.completedAt), "PPP")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Description */}
              {(task.description || task.descriptionAr) && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    {language === 'ar' ? 'الوصف' : 'Description'}
                  </label>
                  {language === 'ar' ? (
                    task.descriptionAr && (
                      <div className="p-4 bg-muted/50 rounded-lg" dir="rtl">
                        <p className="text-sm">{task.descriptionAr}</p>
                      </div>
                    )
                  ) : (
                    task.description && (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm">{task.description}</p>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {language === 'ar' ? `الضوابط المرتبطة (${controls.length})` : `Associated Controls (${controls.length})`}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={controlsViewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setControlsViewMode('cards')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={controlsViewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setControlsViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {controls.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'ar' ? 'لا توجد ضوابط مرتبطة بهذه المهمة' : 'No controls associated with this task'}
                </p>
              ) : (
                <>
                  {/* Card View */}
                  {controlsViewMode === 'cards' && (
                    <div className="space-y-4">
                      {controls.map((control) => (
                        <Card key={control.id} className="p-6 border-l-4 border-l-teal-500">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                                {language === 'ar' ? control.eccControl?.codeAr : control.eccControl?.code} {!control.eccControl?.code && `ID: ${control.eccControlId}`}
                              </Badge>
                              <Badge variant="outline">
                                {language === 'ar' ? 'ضابط ECC' : 'ECC Control'}
                              </Badge>
                            </div>
                            
                            {control.eccControl && (
                              <>
                                <div>
                                  <h4 className={`font-semibold text-lg mb-2 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.domainAr : control.eccControl.domainEn}
                                  </h4>
                                  <p className={`text-sm text-muted-foreground ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.subdomainAr : control.eccControl.subdomainEn}
                                  </p>
                                </div>

                                <div>
                                  <h5 className="font-medium mb-2">
                                    {language === 'ar' ? 'وصف الضابط' : 'Control Description'}
                                  </h5>
                                  <p className={`text-sm ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.controlAr : control.eccControl.controlEn}
                                  </p>
                                </div>

                                {((language === 'ar' && control.eccControl.requirementAr) || (language === 'en' && control.eccControl.requirementEn)) && (
                                  <div>
                                    <h5 className="font-medium mb-2">
                                      {language === 'ar' ? 'المتطلبات' : 'Requirements'}
                                    </h5>
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                      <p className={`text-sm ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                        {language === 'ar' ? control.eccControl.requirementAr : control.eccControl.requirementEn}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {((language === 'ar' && control.eccControl.evidenceAr) || (language === 'en' && control.eccControl.evidenceEn)) && (
                                  <div>
                                    <h5 className="font-medium mb-2">
                                      {language === 'ar' ? 'الأدلة المطلوبة' : 'Evidence Required'}
                                    </h5>
                                    <div className="p-3 bg-orange-50 rounded-lg">
                                      <p className={`text-sm ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                        {language === 'ar' ? control.eccControl.evidenceAr : control.eccControl.evidenceEn}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* List View */}
                  {controlsViewMode === 'list' && (
                    <div className="space-y-2">
                      {controls.map((control) => (
                        <div key={control.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                                {language === 'ar' ? control.eccControl?.codeAr : control.eccControl?.code} {!control.eccControl?.code && `ID: ${control.eccControlId}`}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {language === 'ar' ? 'ضابط ECC' : 'ECC Control'}
                              </Badge>
                            </div>
                            {control.eccControl && (
                              <div>
                                <h4 className={`font-medium text-sm ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                  {language === 'ar' ? control.eccControl.domainAr : control.eccControl.domainEn}
                                </h4>
                                <p className={`text-xs text-muted-foreground ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                  {language === 'ar' ? control.eccControl.subdomainAr : control.eccControl.subdomainEn}
                                </p>
                              </div>
                            )}
                          </div>
                          <Button size="sm" variant="ghost">
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          {/* Evidence Upload Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              {language === 'ar' ? 'رفع أدلة جديدة' : 'Upload New Evidence'}
            </h3>
            
            {/* Control Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {language === 'ar' ? 'اختر الضابط' : 'Select Control'}
              </label>
              <Select 
                value={selectedControlId?.toString() || ''}
                onValueChange={(value) => {
                  const controlId = parseInt(value);
                  setSelectedControlId(controlId);
                  setSelectedControlForView(controlId);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر ضابط لربط الأدلة...' : 'Choose a control to attach evidence...'} />
                </SelectTrigger>
                <SelectContent>
                  {controls.map((control: any) => (
                    <SelectItem key={control.id} value={control.eccControlId.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{language === 'ar' ? control.eccControl?.codeAr : control.eccControl?.code}</span>
                        <span className="text-sm text-muted-foreground">
                          {language === 'ar' ? control.eccControl?.subdomainAr : control.eccControl?.subdomainEn}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Control Information Display */}
            {selectedControlId && controls.find((c: any) => c.eccControl.id === selectedControlId) && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3 mb-3">
                  <Badge variant="secondary" className="mt-1">
                    {controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.code}
                  </Badge>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-gray-900 dark:text-white text-sm mb-2 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                      {language === 'ar' 
                        ? controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.subdomainAr
                        : controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.subdomainEn}
                    </h4>
                    <p className={`text-sm text-gray-700 dark:text-gray-300 mb-3 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                      {language === 'ar'
                        ? controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.controlAr
                        : controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.controlEn}
                    </p>
                    
                    {/* Required Evidence */}
                    <div className="mb-3">
                      <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                      </h5>
                      <p className={`text-xs text-gray-600 dark:text-gray-400 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        {language === 'ar' 
                          ? (controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.evidenceAr || 'وثائق، سياسات، إجراءات، وأدلة تدقيق')
                          : (controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.evidenceEn || 'Documentation, policies, procedures, and audit evidence')}
                      </p>
                    </div>

                    {/* Evidence Link Status */}
                    <div className="flex items-center gap-2">
                      {controlLinkedEvidence && controlLinkedEvidence.length > 0 ? (
                        <div 
                          className="flex items-center gap-1 text-green-600 dark:text-green-400 cursor-pointer hover:text-green-700 dark:hover:text-green-300 transition-colors"
                          onClick={() => setShowEvidenceForControl(!showEvidenceForControl)}
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs font-medium underline">
                            {language === 'ar' 
                              ? `${controlLinkedEvidence.length} أدلة مرتبطة - انقر للعرض`
                              : `${controlLinkedEvidence.length} evidence linked - click to view`}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs">
                            {language === 'ar' ? 'لا توجد أدلة مرتبطة' : 'No evidence linked'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Evidence attachment section */}
            {selectedControlId && (
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {language === 'ar' ? 'ربط الأدلة بالضابط المحدد' : 'Attach Evidence to Selected Control'}
                </h4>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={!selectedControlId}
                    size="sm"
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'رفع ملف جديد' : 'Upload New File'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setLinkExistingDialogOpen(true)}
                    disabled={!selectedControlId}
                    size="sm"
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'ربط ملف موجود' : 'Link Existing File'}
                  </Button>
                </div>
              </div>
            )}

            {/* Display linked evidence for selected control */}
            {showEvidenceForControl && controlLinkedEvidence && controlLinkedEvidence.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-3">
                  {language === 'ar' ? 'الأدلة المرتبطة بهذا الضابط' : 'Evidence Linked to This Control'}
                </h4>
                <div className="space-y-2">
                  {controlLinkedEvidence.map((evidence: any) => (
                    <div key={evidence.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{evidence.title}</p>
                        {evidence.description && (
                          <p className="text-xs text-muted-foreground">{evidence.description}</p>
                        )}
                      </div>
                      {evidence.fileName && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={`/uploads/${evidence.fileName}`} download>
                            <Download className="h-3 w-3 mr-1" />
                            {language === 'ar' ? 'تحميل' : 'Download'}
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Upload Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Evidence</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Evidence title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Evidence description"
                  />
                </div>
                
                <div>
                  <Label htmlFor="file">File *</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                    onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setUploadDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleFileUpload}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Link Existing Evidence Dialog */}
          <Dialog open={linkExistingDialogOpen} onOpenChange={setLinkExistingDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'ربط دليل موجود' : 'Link Existing Evidence'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {allEvidence.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {language === 'ar' ? 'لا توجد أدلة متاحة للربط' : 'No evidence available to link'}
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {allEvidence
                      .filter((evidence: any) => !controlLinkedEvidence.some((linked: any) => linked.id === evidence.id))
                      .map((evidence: any) => (
                        <div
                          key={evidence.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleLinkExistingEvidence(evidence.id)}
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{evidence.title}</p>
                            {evidence.description && (
                              <p className="text-xs text-muted-foreground">{evidence.description}</p>
                            )}
                            {evidence.fileName && (
                              <p className="text-xs text-blue-600">{evidence.fileName}</p>
                            )}
                          </div>
                          <Button size="sm" variant="outline">
                            {language === 'ar' ? 'ربط' : 'Link'}
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
                
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setLinkExistingDialogOpen(false)}
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}