import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Flag, Clock, FileText, Upload, Download, MessageSquare, X, Plus, Grid, List, Building, Shield, AlignLeft, Edit } from "lucide-react";
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
      {/* Hero Header Section */}
      <div className="relative bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent"></div>
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
          <div className="absolute bottom-10 right-10 w-24 h-24 bg-white/5 rounded-full blur-lg"></div>
          <div className="absolute top-20 right-20 w-16 h-16 bg-white/15 rounded-full blur-md"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-6 py-12">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setLocation("/my-tasks")}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:border-white/30 backdrop-blur-sm transition-all"
            >
              {language === 'ar' ? 'العودة للمهام ←' : '← Back to Tasks'}
            </Button>
          </div>
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-white leading-tight">{task.title}</h1>
                  {task.titleAr && (
                    <h2 className="text-xl text-white/80 mt-2" dir="rtl">{task.titleAr}</h2>
                  )}
                </div>
              </div>
              
              {/* Task Meta Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {/* Project Info */}
                {taskProject && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Flag className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/80 font-medium">{language === 'ar' ? 'المشروع' : 'Project'}</p>
                        <p className="text-white font-semibold">{language === 'ar' && taskProject.nameAr ? taskProject.nameAr : taskProject.name}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Assignee Info */}
                {assignedUser && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-white/80 font-medium">{language === 'ar' ? 'المسؤول' : 'Assignee'}</p>
                        <p className="text-white font-semibold">{assignedUser.firstName} {assignedUser.lastName}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Due Date */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-white/80 font-medium">{language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</p>
                      <p className="text-white font-semibold">
                        {task.dueDate ? format(new Date(task.dueDate), "MMM dd, yyyy") : (language === 'ar' ? 'غير محدد' : 'Not set')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Badges */}
            <div className="flex flex-col gap-3">
              <Badge className={`${getPriorityColor(task.priority)} text-lg px-4 py-2 font-semibold shadow-lg`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </Badge>
              <Badge className={`${getStatusColor(task.status)} text-lg px-4 py-2 font-semibold shadow-lg`}>
                {task.status.replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 -mt-8 relative z-20">

        {/* Modern Tabs Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border-0 overflow-hidden">
          <Tabs defaultValue="details" className="w-full">
            <div className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-200 dark:border-gray-700">
              <TabsList className="grid w-full grid-cols-3 bg-transparent p-2 h-auto">
                <TabsTrigger 
                  value="details" 
                  className="flex items-center gap-3 py-4 px-6 text-sm font-semibold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-teal-600 data-[state=active]:border-teal-200 hover:bg-white/50"
                >
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div>{language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}</div>
                    <div className="text-xs text-gray-500">{language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}</div>
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="controls" 
                  className="flex items-center gap-3 py-3 px-4 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 dark:data-[state=active]:bg-teal-900/20 dark:data-[state=active]:text-teal-300"
                >
                  <Shield className="h-4 w-4" />
                  <div className="text-left">
                    <div>{language === 'ar' ? 'الضوابط' : 'Controls'}</div>
                    <div className="text-xs text-gray-500">
                      {controls.length} {language === 'ar' ? 'ضابط' : 'items'}
                    </div>
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="evidence" 
                  className="flex items-center gap-3 py-3 px-4 text-sm font-medium rounded-lg transition-all data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 dark:data-[state=active]:bg-teal-900/20 dark:data-[state=active]:text-teal-300"
                >
                  <Upload className="h-4 w-4" />
                  <div className="text-left">
                    <div>{language === 'ar' ? 'الأدلة' : 'Evidence'}</div>
                    <div className="text-xs text-gray-500">
                      {evidence.length} {language === 'ar' ? 'دليل' : 'files'}
                    </div>
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-8">
              {/* Task Description Card */}
              {(task.description || task.descriptionAr) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'وصف المهمة' : 'Task Description'}
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {language === 'ar' && task.descriptionAr ? (
                      <p className="leading-relaxed" dir="rtl">{task.descriptionAr}</p>
                    ) : (
                      <p className="leading-relaxed">{task.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Status and Progress Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Task Status Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="h-4 w-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'حالة المهمة' : 'Task Status'}
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'ar' ? 'الحالة' : 'Status'}
                      </span>
                      <Badge className={`${getStatusColor(task.status)} text-xs`}>
                        {task.status.replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'ar' ? 'الأولوية' : 'Priority'}
                      </span>
                      <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                    </div>
                    
                    {task.completedAt && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'ar' ? 'تاريخ الإنجاز' : 'Completed'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(task.completedAt), "MMM dd, yyyy")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Task Details Card */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'تفاصيل المهمة' : 'Task Details'}
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    {assignedUser && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {language === 'ar' ? 'المسؤول' : 'Assignee'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {assignedUser.firstName} {assignedUser.lastName}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {task.dueDate ? format(new Date(task.dueDate), "MMM dd, yyyy") : (language === 'ar' ? 'غير محدد' : 'Not set')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {task.createdAt ? format(new Date(task.createdAt), "MMM dd, yyyy") : (language === 'ar' ? 'غير معروف' : 'Unknown')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project Information */}
              {taskProject && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Building className="h-4 w-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'معلومات المشروع' : 'Project Information'}
                    </h3>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {language === 'ar' ? 'اسم المشروع' : 'Project Name'}
                    </p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' && taskProject.nameAr ? taskProject.nameAr : taskProject.name}
                    </p>
                    {language !== 'ar' && taskProject.nameAr && (
                      <p className="text-sm text-gray-600 dark:text-gray-400" dir="rtl">{taskProject.nameAr}</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="controls" className="p-8">
              {/* Controls Header */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <Flag className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'الضوابط المرتبطة' : 'Associated Controls'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {controls.length} {language === 'ar' ? 'ضابط مرتبط' : 'controls linked to this task'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
                  <Button
                    variant={controlsViewMode === 'cards' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setControlsViewMode('cards')}
                    className={controlsViewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-md' : ''}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={controlsViewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setControlsViewMode('list')}
                    className={controlsViewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-md' : ''}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {controls.length === 0 ? (
                <div className="text-center py-16">
                  <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-2xl max-w-md mx-auto">
                    <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">
                      {language === 'ar' ? 'لا توجد ضوابط مرتبطة بهذه المهمة' : 'No controls associated with this task'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Card View */}
                  {controlsViewMode === 'cards' && (
                    <div className="space-y-6">
                      {controls.map((control, index) => (
                        <div 
                          key={control.id} 
                          className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                        >
                          <div className="space-y-5">
                            {/* Header with badges */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg">
                                  <span className="text-white font-bold text-sm">
                                    {language === 'ar' ? control.eccControl?.codeAr || `${control.eccControlId}` : control.eccControl?.code || `ID: ${control.eccControlId}`}
                                  </span>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  {language === 'ar' ? 'ضابط ECC' : 'ECC Control'}
                                </Badge>
                              </div>
                              <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                #{index + 1}
                              </div>
                            </div>
                            
                            {control.eccControl && (
                              <>
                                {/* Domain and Subdomain */}
                                <div className="bg-white/70 dark:bg-blue-900/30 rounded-xl p-4">
                                  <h4 className={`font-bold text-lg mb-2 text-blue-900 dark:text-blue-100 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.domainAr : control.eccControl.domainEn}
                                  </h4>
                                  <p className={`text-sm text-blue-700 dark:text-blue-300 ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.subdomainAr : control.eccControl.subdomainEn}
                                  </p>
                                </div>

                                {/* Control Description */}
                                <div className="bg-white/70 dark:bg-blue-900/30 rounded-xl p-4">
                                  <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    {language === 'ar' ? 'وصف الضابط' : 'Control Description'}
                                  </h5>
                                  <p className={`text-sm text-blue-800 dark:text-blue-200 leading-relaxed ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                    {language === 'ar' ? control.eccControl.controlAr : control.eccControl.controlEn}
                                  </p>
                                </div>

                                {/* Requirements */}
                                {((language === 'ar' && control.eccControl.requirementAr) || (language === 'en' && control.eccControl.requirementEn)) && (
                                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
                                    <h5 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                                      <Flag className="h-4 w-4" />
                                      {language === 'ar' ? 'المتطلبات' : 'Requirements'}
                                    </h5>
                                    <p className={`text-sm text-amber-800 dark:text-amber-200 leading-relaxed ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                      {language === 'ar' ? control.eccControl.requirementAr : control.eccControl.requirementEn}
                                    </p>
                                  </div>
                                )}

                                {/* Evidence Required */}
                                {((language === 'ar' && control.eccControl.evidenceAr) || (language === 'en' && control.eccControl.evidenceEn)) && (
                                  <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                                    <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
                                      <Upload className="h-4 w-4" />
                                      {language === 'ar' ? 'الأدلة المطلوبة' : 'Evidence Required'}
                                    </h5>
                                    <div className={`text-sm text-green-800 dark:text-green-200 leading-relaxed ${language === 'ar' ? 'text-right' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
                                      {((language === 'ar' ? control.eccControl.evidenceAr : control.eccControl.evidenceEn) || '').split('\n').map((line, i) => (
                                        <p key={i} className="mb-1">{line}</p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
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
            </TabsContent>

            <TabsContent value="evidence" className="space-y-6">
              {/* Evidence Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="h-6 w-6 text-teal-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'إدارة الأدلة' : 'Evidence Management'}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {evidence.length} {language === 'ar' ? 'دليل مرفوع' : 'files uploaded'}
                    </p>
                  </div>
                </div>
                
                {canUploadEvidence && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setUploadDialogOpen(true)}
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'رفع دليل' : 'Upload'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setLinkExistingDialogOpen(true)}
                      className="border-gray-300 hover:bg-gray-50"
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'ربط موجود' : 'Link Existing'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Control Selection */}
              {controls.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <Flag className="h-4 w-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {language === 'ar' ? 'اختر الضابط لعرض الأدلة' : 'Select Control to View Evidence'}
                    </h3>
                  </div>
                  
                  <Select 
                    value={selectedControlId?.toString() || ''}
                    onValueChange={(value) => {
                      const controlId = parseInt(value);
                      setSelectedControlId(controlId);
                      setSelectedControlForView(controlId);
                    }}
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-800">
                      <SelectValue placeholder={language === 'ar' ? 'اختر ضابط...' : 'Choose a control...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {controls.map((control: any) => (
                        <SelectItem key={control.id} value={control.eccControlId.toString()}>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {language === 'ar' ? control.eccControl?.codeAr : control.eccControl?.code}
                            </Badge>
                            <span className="text-sm">
                              {language === 'ar' ? control.eccControl?.subdomainAr : control.eccControl?.subdomainEn}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Evidence Grid */}
              {evidence.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg max-w-sm mx-auto">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {language === 'ar' ? 'لا توجد أدلة مرفوعة' : 'No evidence uploaded'}
                    </p>
                    {canUploadEvidence && (
                      <Button 
                        onClick={() => setUploadDialogOpen(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white"
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'رفع دليل' : 'Upload Evidence'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {evidence.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow"
                    >
                      <div className="space-y-3">
                        {/* File Info */}
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                              {item.title}
                            </h3>
                            {item.fileName && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {item.fileName}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        {item.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex justify-between items-center pt-2">
                          {item.createdAt && (
                            <span className="text-xs text-gray-500">
                              {format(new Date(item.createdAt), "MMM dd")}
                            </span>
                          )}
                          {item.fileName && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              asChild 
                              className="h-7 px-2 text-xs"
                            >
                              <a href={`/uploads/${item.fileName}`} download>
                                <Download className="h-3 w-3 mr-1" />
                                {language === 'ar' ? 'تحميل' : 'Download'}
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Control-Linked Evidence Display */}
              {selectedControlId && controlLinkedEvidence && controlLinkedEvidence.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Flag className="h-4 w-4 text-teal-600" />
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {language === 'ar' ? 'الأدلة المرتبطة بالضابط' : 'Evidence Linked to Control'}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {controlLinkedEvidence.length} {language === 'ar' ? 'دليل مرتبط' : 'items linked'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {controlLinkedEvidence.map((evidence: any) => (
                      <div 
                        key={evidence.id} 
                        className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {evidence.title}
                            </h4>
                            {evidence.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-1">
                                {evidence.description}
                              </p>
                            )}
                            {evidence.fileName && (
                              <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                                {evidence.fileName}
                              </p>
                            )}
                          </div>
                          {evidence.fileName && (
                            <Button size="sm" variant="outline" asChild className="ml-2 h-7 px-2">
                              <a href={`/uploads/${evidence.fileName}`} download>
                                <Download className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            
          </Tabs>
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-teal-600" />
                {language === 'ar' ? 'رفع دليل جديد' : 'Upload New Evidence'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">
                  {language === 'ar' ? 'العنوان' : 'Title'} *
                </Label>
                <Input
                  id="title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={language === 'ar' ? 'عنوان الدليل...' : 'Evidence title...'}
                />
              </div>
              
              <div>
                <Label htmlFor="description">
                  {language === 'ar' ? 'الوصف' : 'Description'}
                </Label>
                <Textarea
                  id="description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={language === 'ar' ? 'وصف الدليل...' : 'Evidence description...'}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="file">
                  {language === 'ar' ? 'الملف' : 'File'} *
                </Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                  onChange={(e) => setUploadForm(prev => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setUploadDialogOpen(false)}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button
                  onClick={handleFileUpload}
                  disabled={uploadMutation.isPending}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {language === 'ar' ? 'جارٍ الرفع...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'رفع' : 'Upload'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Link Existing Evidence Dialog */}
        <Dialog open={linkExistingDialogOpen} onOpenChange={setLinkExistingDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-teal-600" />
                {language === 'ar' ? 'ربط دليل موجود' : 'Link Existing Evidence'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {allEvidence.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {language === 'ar' ? 'لا توجد أدلة متاحة للربط' : 'No evidence available to link'}
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {allEvidence
                    .filter((evidence: any) => !controlLinkedEvidence.some((linked: any) => linked.id === evidence.id))
                    .map((evidence: any) => (
                      <div
                        key={evidence.id}
                        className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => handleLinkExistingEvidence(evidence.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                              {evidence.title}
                            </p>
                            {evidence.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {evidence.description}
                              </p>
                            )}
                            {evidence.fileName && (
                              <p className="text-xs text-teal-600 dark:text-teal-400">
                                {evidence.fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                          {language === 'ar' ? 'ربط' : 'Link'}
                        </Button>
                      </div>
                    ))}
                </div>
              )}
              
              <div className="flex justify-end pt-4">
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
      </div>
    </AppLayout>
  );
}