import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Flag, Clock, FileText, Upload, Download, MessageSquare, X, Plus, Grid, List, AlertTriangle, CheckCircle, ArrowRight, ArrowLeft, UserCheck } from "lucide-react";
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
import type { Task, User as UserType, ProjectControl, Evidence, EvidenceVersion, TaskWorkflow, TaskReviewRoute, TaskWorkflowEvent } from "@shared/schema";
import Comments from '@/components/comments/Comments';
import { toggleRisk } from "@/lib/api/risk";
import { getWorkflow, setRoute, submitStep, returnTo, approve, reject } from "@/lib/api/workflows";
import RejectDialog from '@/components/workflow/RejectDialog';

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
  
  // All useState hooks first
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
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

  // All useQuery hooks
  const { data: currentUser } = useQuery<UserType>({
    queryKey: ["/api/auth/user"]
  });

  const { data: task, isLoading: taskLoading } = useQuery<TaskWithDetails>({
    queryKey: [`/api/tasks/${taskId}`]
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"]
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"]
  });

  const { data: controls = [] } = useQuery<any[]>({
    queryKey: [`/api/tasks/${taskId}/controls`]
  });

  const { data: evidence = [] } = useQuery<Evidence[]>({
    queryKey: [`/api/evidence/task/${taskId}`]
  });

  const { data: versions = [] } = useQuery<EvidenceVersion[]>({
    queryKey: [`/api/evidence/versions?taskId=${taskId}`]
  });

  const { data: workflow, refetch: refetchWorkflow } = useQuery<{
    workflow: TaskWorkflow | null;
    route: TaskReviewRoute[];
    history: TaskWorkflowEvent[];
  }>({
    queryKey: [`/api/workflows?taskId=${taskId}`],
    enabled: !!taskId,
  });

  const { data: controlLinkedEvidence = [] } = useQuery<Evidence[]>({
    queryKey: [`/api/controls/${selectedControlForView}/evidence`],
    enabled: !!selectedControlForView,
  });

  const { data: allEvidence = [] } = useQuery<Evidence[]>({
    queryKey: ["/api/evidence"]
  });

  // Workflow mutations
  const setRouteMutation = useMutation({
    mutationFn: async (steps: { userId: string; role: string }[]) => {
      if (!taskId) throw new Error("No task ID");
      return setRoute(parseInt(taskId), steps);
    },
    onSuccess: () => {
      refetchWorkflow();
      toast({
        title: language === 'ar' ? 'تم حفظ مسار العمل' : 'Workflow route saved',
        description: language === 'ar' ? 'تم تحديد مسار المراجعة بنجاح' : 'Review route has been set successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في حفظ مسار العمل' : 'Failed to save workflow route'),
        variant: "destructive"
      });
    }
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!taskId) throw new Error("No task ID");
      return submitStep(parseInt(taskId));
    },
    onSuccess: () => {
      refetchWorkflow();
      toast({
        title: language === 'ar' ? 'تم إرسال المهمة' : 'Task submitted',
        description: language === 'ar' ? 'تم إرسال المهمة للمراجع التالي' : 'Task has been sent to the next reviewer'
      });
    }
  });

  const returnMutation = useMutation({
    mutationFn: async ({ toUserId, comment }: { toUserId: string; comment: string }) => {
      if (!taskId) throw new Error("No task ID");
      return returnTo(parseInt(taskId), toUserId, comment);
    },
    onSuccess: () => {
      refetchWorkflow();
      toast({
        title: language === 'ar' ? 'تم إرجاع المهمة' : 'Task returned',
        description: language === 'ar' ? 'تم إرجاع المهمة للمراجع المحدد' : 'Task has been returned to the specified reviewer'
      });
    }
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!taskId) throw new Error("No task ID");
      return approve(parseInt(taskId));
    },
    onSuccess: () => {
      refetchWorkflow();
      toast({
        title: language === 'ar' ? 'تم الموافقة' : 'Task approved',
        description: language === 'ar' ? 'تم الموافقة على المهمة نهائياً' : 'Task has been approved successfully'
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ toUserId, comment }: { toUserId: string; comment: string }) => {
      if (!taskId) throw new Error("No task ID");
      return reject(parseInt(taskId), toUserId, comment);
    },
    onSuccess: () => {
      refetchWorkflow();
      toast({
        title: language === 'ar' ? 'تم رفض المهمة' : 'Task rejected',
        description: language === 'ar' ? 'تم رفض المهمة وإرجاعها للتعديل' : 'Task has been rejected and returned for revision'
      });
    }
  });

  // All useMutation hooks
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/evidence/upload`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "include"
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to upload evidence');
      }
      return response.json();
    },
    onSuccess: async () => {
      toast({
        title: language === 'ar' ? 'تم الرفع بنجاح' : 'Success',
        description: language === 'ar' ? 'تم رفع الدليل بنجاح' : 'Evidence uploaded successfully'
      });
      setUploadDialogOpen(false);
      setUploadForm({ title: "", description: "", file: null });
      queryClient.invalidateQueries({ queryKey: ["/api/evidence/task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/evidence"] });
      if (selectedControlId) {
        queryClient.invalidateQueries({ queryKey: ['/api/evidence/control', selectedControlId] });
      }
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error.message || (language === 'ar' ? 'فشل في رفع الدليل' : 'Failed to upload evidence'),
        variant: "destructive"
      });
    }
  });

  const riskToggleMutation = useMutation({
    mutationFn: (makeRisk: boolean) => toggleRisk(parseInt(taskId || "0"), makeRisk),
    onSuccess: (data, makeRisk) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId || "0"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risks"] });
      toast({
        title: makeRisk ? 'Task converted to Risk' : 'Risk converted back to Task',
        description: makeRisk 
          ? 'This task is now tracked as a risk in the Risk Register' 
          : 'This task is no longer considered a risk',
      });
    },
    onError: () => {
      toast({
        title: 'Toggle failed',
        description: 'Failed to update risk status',
        variant: 'destructive',
      });
    }
  });

  // All useEffect hooks
  useEffect(() => {
    if (controls.length > 0 && !selectedControlId) {
      const firstControl = controls[0];
      if (firstControl?.eccControl?.id) {
        setSelectedControlId(firstControl.eccControl.id);
        setSelectedControlForView(firstControl.eccControl.id);
      }
    }
  }, [controls, selectedControlId]);

  // Sync selectedControlForView with selectedControlId whenever it changes
  useEffect(() => {
    if (selectedControlId) {
      console.log('🎯 Setting selectedControlForView to:', selectedControlId);
      setSelectedControlForView(selectedControlId);
    }
  }, [selectedControlId]);

  // Debug: Log when controlLinkedEvidence changes
  useEffect(() => {
    console.log('📋 controlLinkedEvidence updated:', {
      selectedControlForView,
      evidenceCount: controlLinkedEvidence?.length || 0,
      evidence: controlLinkedEvidence
    });
  }, [controlLinkedEvidence, selectedControlForView]);

  // Early returns AFTER all hooks
  if (!taskId) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Invalid task ID</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (taskLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Loading task details...</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Task not found</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Calculate derived data
  const taskProject = projects.find((p: any) => p.id === task?.projectId);
  const assignedUser = users.find((u: any) => u.id === task?.assigneeId);
  const createdByUser = users.find((u: any) => u.id === task?.createdById);


  // Check if user can upload evidence (assigned to task or admin/manager)
  const canUploadEvidence = currentUser && (
    task.assigneeId === currentUser.id ||
    currentUser.role === "admin" ||
    currentUser.role === "manager"
  );

  const handleFileUpload = async () => {
    if (!uploadForm.file) {
      toast({
        title: "Error",
        description: "Please select a file",
        variant: "destructive"
      });
      return;
    }

    if (!selectedControlId) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'يرجى اختيار ضابط أولاً' : 'Please select a control first',
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append("files", uploadForm.file);
    formData.append("taskId", taskId);
    formData.append("projectId", task.projectId?.toString() || "");
    formData.append("controlId", selectedControlId.toString());
    if (uploadForm.title.trim()) {
      formData.append("title", uploadForm.title);
    }
    if (uploadForm.description.trim()) {
      formData.append("description", uploadForm.description);
    }

    uploadMutation.mutate(formData);
  };

  // Handle linking existing evidence to the selected control or task
  const handleLinkExistingEvidence = async (evidenceId: number) => {
    try {
      // Link to control if one is selected, otherwise link to task
      if (selectedControlId) {
        await apiRequest(`/api/evidence/${evidenceId}/controls`, 'POST', { 
          controlIds: [selectedControlId] 
        });
        
        // Refresh the control linked evidence
        queryClient.invalidateQueries({ queryKey: ['/api/evidence/control', selectedControlId] });
      } else {
        // Link evidence to task by updating its taskId
        await apiRequest(`/api/evidence/${evidenceId}`, 'PATCH', {
          taskId: parseInt(taskId || '0')
        });
      }

      // Refresh all evidence queries
      queryClient.invalidateQueries({ queryKey: ['/api/evidence'] });
      queryClient.invalidateQueries({ queryKey: [`/api/evidence/task/${taskId}`] });
      
      toast({
        title: language === 'ar' ? 'تم الربط بنجاح' : 'Linked Successfully',
        description: selectedControlId 
          ? (language === 'ar' ? 'تم ربط الدليل بالضابط بنجاح' : 'Evidence linked to control successfully')
          : (language === 'ar' ? 'تم ربط الدليل بالمهمة بنجاح' : 'Evidence linked to task successfully'),
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
        
        {task && (
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => riskToggleMutation.mutate(!task.isRisk)}
              disabled={riskToggleMutation.isPending}
              className={task.isRisk ? 
                "border-red-500 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900 shadow-md" : 
                "border-orange-500 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-600 dark:hover:bg-orange-900 shadow-md"
              }
            >
              <AlertTriangle className={`h-4 w-4 mr-2 ${task.isRisk ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />
              {task.isRisk ? 'Remove Risk' : 'Mark as Risk'}
            </Button>
          </div>
        </div>
        )}
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
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
          <TabsTrigger value="workflow" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            {language === 'ar' ? 'سير العمل' : 'Workflow'}
            {workflow?.workflow?.state && (
              <Badge variant={workflow.workflow.state === 'approved' ? 'default' : 'secondary'} className="ml-1">
                {workflow.workflow.state}
              </Badge>
            )}
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

          {/* Comments Section - Task Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {language === 'ar' ? 'التعليقات - تفاصيل المهمة' : 'Comments - Task Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Comments targetType="task" targetId={parseInt(taskId || '0')} />
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

          {/* Comments Section - Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {language === 'ar' ? 'التعليقات - الضوابط' : 'Comments - Controls'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Comments targetType="task" targetId={parseInt(taskId || '0')} />
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
                  {controls.map((control: any) => {
                    // Use the eccControl ID (this is the regulation control ID from the modern system)
                    const valueId = control.eccControl?.id?.toString();
                    if (!valueId) return null; // Skip controls without valid IDs

                    // Get control information from eccControl (which is actually the mapped regulation control)
                    const controlInfo = control.eccControl;
                    if (!controlInfo) return null;

                    return (
                    <SelectItem key={control.id} value={valueId}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {language === 'ar'
                            ? (controlInfo.codeAr || controlInfo.code)
                            : (controlInfo.code)
                          }
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {language === 'ar'
                            ? (controlInfo.subdomainAr || controlInfo.subdomainEn)
                            : (controlInfo.subdomainEn)
                          }
                        </span>
                      </div>
                    </SelectItem>
                    );
                  }).filter(Boolean)}
                </SelectContent>
              </Select>
            </div>

            {/* Control Information Display */}
            {selectedControlId && controls.find((c: any) => c.eccControl?.id === selectedControlId) && (() => {
              const selectedControl = controls.find((c: any) => c.eccControl?.id === selectedControlId);
              const controlInfo = selectedControl?.eccControl;
              
              return (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-3 mb-3">
                    <Badge variant="secondary" className="mt-1">
                      {language === 'ar' 
                        ? (controlInfo?.codeAr || controlInfo?.clause || controlInfo?.code)
                        : (controlInfo?.code || controlInfo?.clause)
                      }
                    </Badge>
                    <div className="flex-1">
                      <h4 className={`font-semibold text-gray-900 dark:text-white text-sm mb-2 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        {language === 'ar' 
                          ? (controlInfo?.titleAr || controlInfo?.controlAr || controlInfo?.subdomainAr || 'تفاصيل الضابط')
                          : (controlInfo?.titleEn || controlInfo?.controlEn || controlInfo?.subdomainEn || 'Control Details')
                        }
                      </h4>
                      <p className={`text-sm text-gray-700 dark:text-gray-300 mb-3 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                        {language === 'ar'
                          ? (controlInfo?.descriptionAr || controlInfo?.controlAr || controlInfo?.titleAr || 'وصف الضابط')
                          : (controlInfo?.descriptionEn || controlInfo?.controlEn || controlInfo?.titleEn || 'Control Description')
                        }
                      </p>
                      
                      {/* Required Evidence */}
                      <div className="mb-3">
                        <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                          {language === 'ar' ? 'الأدلة المطلوبة:' : 'Required Evidence:'}
                        </h5>
                        <p className={`text-xs text-gray-600 dark:text-gray-400 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                          {language === 'ar' 
                            ? (controlInfo?.evidenceRequiredAr || controlInfo?.evidenceAr || 'وثائق، سياسات، إجراءات، وأدلة تدقيق')
                            : (controlInfo?.evidenceRequiredEn || controlInfo?.evidenceEn || 'Documentation, policies, procedures, and audit evidence')
                          }
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
              );
            })()}

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
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>Upload Evidence</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Title (Optional)</Label>
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
            <DialogContent aria-describedby={undefined}>
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'ربط دليل موجود' : 'Link Existing Evidence'}
                </DialogTitle>
                {!selectedControlId && (
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' 
                      ? 'سيتم ربط الدليل بالمهمة مباشرة (لا توجد ضوابط محددة)' 
                      : 'Evidence will be linked directly to the task (no control selected)'}
                  </p>
                )}
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

          {/* Comments Section - Evidence */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {language === 'ar' ? 'التعليقات - الأدلة' : 'Comments - Evidence'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Comments targetType="task" targetId={parseInt(taskId || '0')} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  {language === 'ar' ? 'مسار المراجعة' : 'Review Workflow'}
                </CardTitle>
                <Badge variant="secondary" className="capitalize">
                  {workflow?.workflow?.state?.replaceAll("_"," ") || 'draft'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Review Route - Always Visible */}
              {workflow?.route && workflow.route.length > 0 ? (
                <div>
                  <h4 className="font-semibold mb-3">{language === 'ar' ? 'مسار المراجعة' : 'Review Route'}</h4>
                  <div className="space-y-2">
                    {workflow.route.map((step, index) => {
                      const user = users.find(u => u.id === step.userId);
                      const isCurrent = workflow.workflow?.currentStepIndex === index;
                      const isCompleted = workflow.workflow && workflow.workflow.currentStepIndex > index;
                      
                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            isCurrent ? 'bg-blue-50 border-blue-200' : 
                            isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCurrent ? 'bg-blue-500 text-white' : 
                            isCompleted ? 'bg-green-500 text-white' : 'bg-gray-300'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <span className="text-sm font-medium">{index + 1}</span>
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="font-medium">
                              {user?.firstName} {user?.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {step.role}
                            </div>
                          </div>
                          
                          {isCurrent && (
                            <Badge variant="outline">
                              {language === 'ar' ? 'حالي' : 'Current'}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>{language === 'ar' ? 'لم يتم إعداد مسار المراجعة بعد' : 'No review route set up yet'}</p>
                </div>
              )}

              {/* Current Assignee Info */}
              {workflow?.workflow?.currentAssigneeId && (
                <div className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4" />
                    <span>{language === 'ar' ? 'المراجع الحالي:' : 'Current Reviewer:'}</span>
                    <span className="font-medium">
                      {users.find(u => u.id === workflow.workflow!.currentAssigneeId)?.firstName} {users.find(u => u.id === workflow.workflow!.currentAssigneeId)?.lastName}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {workflow?.workflow && currentUser && (
                <div className="flex gap-2 pt-4 border-t">
                  {/* Submit Button */}
                  {workflow.workflow.currentAssigneeId === currentUser.id && 
                   workflow.workflow.state !== 'approved' && 
                   workflow.workflow.state !== 'rejected' && (
                    <Button 
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <ArrowRight className="h-4 w-4" />
                      {language === 'ar' ? 'إرسال للتالي' : 'Submit to Next'}
                    </Button>
                  )}
                  
                  {/* Admin/Compliance Actions */}
                  {(currentUser.role === 'admin' || currentUser.role === 'manager') && 
                   workflow.workflow.state === 'compliance_review' && (
                    <>
                      <Button 
                        onClick={() => approveMutation.mutate()}
                        disabled={approveMutation.isPending}
                        variant="default"
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {language === 'ar' ? 'موافقة' : 'Approve'}
                      </Button>
                      
                      <Button 
                        onClick={() => setRejectDialogOpen(true)}
                        disabled={rejectMutation.isPending}
                        variant="destructive"
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        {language === 'ar' ? 'رفض' : 'Reject'}
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {/* Reject Dialog */}
              <RejectDialog
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
                candidates={(workflow?.route || []).map(r => {
                  const user = Array.isArray(users) ? users.find((u: any) => u.id === r.userId) : undefined;
                  return { 
                    userId: r.userId, 
                    name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email || '' : r.userId,
                    email: user?.email || ''
                  };
                })}
                onConfirm={({toUserId, comment}) => {
                  rejectMutation.mutate({ toUserId, comment });
                  setRejectDialogOpen(false);
                }}
              />

              {/* Workflow History */}
              {workflow?.history && workflow.history.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">{language === 'ar' ? 'تاريخ المراجعة' : 'Review History'}</h4>
                  <div className="space-y-3">
                    {workflow.history.map((event, index) => {
                      const actor = users.find(u => u.id === event.actorId);
                      
                      return (
                        <div key={event.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.name || actor.email : event.actorId}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {event.action}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {event.createdAt ? format(new Date(event.createdAt), 'MMM dd, yyyy HH:mm') : ''}
                              </span>
                            </div>
                            
                            {event.comment && (
                              <div className="text-sm text-muted-foreground bg-background p-2 rounded border">
                                {event.comment}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Setup Workflow Route */}
              {(!workflow?.route || workflow.route.length === 0) && currentUser?.role === 'admin' && (
                <div className="text-center py-6 border-2 border-dashed rounded-lg">
                  <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h4 className="font-semibold mb-2">
                    {language === 'ar' ? 'لم يتم تحديد مسار المراجعة' : 'No Review Route Set'}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {language === 'ar' ? 'قم بإعداد مسار المراجعة لهذه المهمة' : 'Set up a review route for this task'}
                  </p>
                  <Button
                    onClick={() => {
                      // Simple route setup - in production this would be a proper dialog
                      console.log('Available users:', users.map(u => ({ 
                        id: u.id, 
                        email: u.email, 
                        role: u.role,
                        name: u.name,
                        fullUserData: u 
                      })));
                      
                      // Find reviewers - try multiple role types since the exact roles may vary
                      let reviewers = users.filter(u => 
                        u.role === 'manager' || 
                        u.role === 'viewer' || 
                        u.role === 'admin' ||
                        (u.role && u.role !== currentUser?.role && u.id !== currentUser?.id)
                      );
                      
                      // Fallback: if no users found with expected roles, use any other users except current user
                      if (reviewers.length === 0) {
                        reviewers = users.filter(u => 
                          u.id !== currentUser?.id && 
                          u.email && 
                          u.email !== currentUser?.email
                        );
                        console.log('No users with expected roles found, using fallback reviewers');
                      }
                      
                      console.log('Filtered reviewers:', reviewers.map(u => ({ id: u.id, email: u.email, role: u.role })));
                      
                      if (reviewers.length > 0) {
                        const steps = reviewers.slice(0, 2).map((user, index) => ({
                          userId: user.id,
                          role: user.role || 'reviewer'
                        }));
                        console.log('Creating workflow steps:', steps);
                        setRouteMutation.mutate(steps);
                      } else {
                        toast({
                          title: language === 'ar' ? 'خطأ' : 'Error',
                          description: language === 'ar' ? 'لا يوجد مستخدمون مؤهلون للمراجعة' : 'No eligible reviewers found',
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={setRouteMutation.isPending}
                  >
                    {language === 'ar' ? 'إعداد مسار المراجعة' : 'Set Review Route'}
                  </Button>
                </div>
              )}
              
            </CardContent>
          </Card>

          {/* Comments Section - Workflow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {language === 'ar' ? 'التعليقات - سير العمل' : 'Comments - Workflow'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Comments targetType="task" targetId={parseInt(taskId || '0')} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}