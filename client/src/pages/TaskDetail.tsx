import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Flag, Clock, FileText, Upload, Download, MessageSquare, X, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
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
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [linkExistingDialogOpen, setLinkExistingDialogOpen] = useState(false);
  const [selectedControlId, setSelectedControlId] = useState<number | null>(null);
  const [selectedControlForView, setSelectedControlForView] = useState<number | null>(null);
  const [showEvidenceForControl, setShowEvidenceForControl] = useState(false);
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
          onClick={() => setLocation("/tasks")}
          className="mb-4"
        >
          ← Back to Tasks
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
            Task Details
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            Controls ({controls.length})
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Evidence ({evidence.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task Title */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold">{task.title}</h2>
                  <div className="flex gap-2">
                    <Badge 
                      variant="secondary" 
                      className={
                        task.status === "completed" ? "bg-green-100 text-green-800" :
                        task.status === "in-progress" ? "bg-blue-100 text-blue-800" :
                        task.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }
                    >
                      {task.status}
                    </Badge>
                    <Badge 
                      variant="outline"
                      className={
                        task.priority === "urgent" ? "border-red-500 text-red-700" :
                        task.priority === "high" ? "border-orange-500 text-orange-700" :
                        task.priority === "medium" ? "border-yellow-500 text-yellow-700" :
                        "border-green-500 text-green-700"
                      }
                    >
                      <Flag className="h-3 w-3 mr-1" />
                      {task.priority}
                    </Badge>
                  </div>
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
                    <label className="text-sm font-medium text-muted-foreground">Created by</label>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{createdByUser ? `${createdByUser.firstName || ''} ${createdByUser.lastName || ''}`.trim() || createdByUser.email : "Unknown"}</span>
                    </div>
                    {createdByUser?.email && (
                      <p className="text-xs text-muted-foreground">{createdByUser.email}</p>
                    )}
                  </div>
                  
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
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  {task.description && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm">{task.description}</p>
                    </div>
                  )}
                  {task.descriptionAr && (
                    <div className="p-4 bg-muted/50 rounded-lg" dir="rtl">
                      <p className="text-sm">{task.descriptionAr}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls">
          <Card>
            <CardHeader>
              <CardTitle>Associated Controls ({controls.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {controls.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No controls associated with this task
                </p>
              ) : (
                <div className="space-y-4">
                  {controls.map((control) => (
                    <Card key={control.id} className="p-6 border-l-4 border-l-teal-500">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                            {control.eccControl?.code || `ID: ${control.eccControlId}`}
                          </Badge>
                          <Badge variant="outline">
                            ECC Control
                          </Badge>
                        </div>
                        
                        {control.eccControl && (
                          <>
                            <div>
                              <h4 className="font-semibold text-lg mb-2">
                                {control.eccControl.domainEn}
                              </h4>
                              {control.eccControl.domainAr && (
                                <p className="text-muted-foreground mb-2" dir="rtl">
                                  {control.eccControl.domainAr}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                {control.eccControl.subdomainEn}
                              </p>
                              {control.eccControl.subdomainAr && (
                                <p className="text-sm text-muted-foreground" dir="rtl">
                                  {control.eccControl.subdomainAr}
                                </p>
                              )}
                            </div>

                            <div>
                              <h5 className="font-medium mb-2">Control Description</h5>
                              <p className="text-sm mb-2">
                                {control.eccControl.controlEn}
                              </p>
                              {control.eccControl.controlAr && (
                                <p className="text-sm text-muted-foreground" dir="rtl">
                                  {control.eccControl.controlAr}
                                </p>
                              )}
                            </div>

                            {control.eccControl.requirementAr && (
                              <div>
                                <h5 className="font-medium mb-2">Requirements</h5>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                  <p className="text-sm" dir="rtl">
                                    {control.eccControl.requirementAr}
                                  </p>
                                </div>
                              </div>
                            )}

                            {control.eccControl.evidenceAr && (
                              <div>
                                <h5 className="font-medium mb-2">Evidence Required</h5>
                                <div className="p-3 bg-orange-50 rounded-lg">
                                  <p className="text-sm" dir="rtl">
                                    {control.eccControl.evidenceAr}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          {/* Evidence Upload Section */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Upload New Evidence
            </h3>
            
            {/* Control Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Control
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
                  <SelectValue placeholder="Choose a control to attach evidence..." />
                </SelectTrigger>
                <SelectContent>
                  {controls.map((control: any) => (
                    <SelectItem key={control.id} value={control.eccControlId.toString()}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{control.eccControl?.code}</span>
                        <span className="text-sm text-muted-foreground">
                          {control.eccControl?.subdomainEn}
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
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                      {controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.subdomainEn}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                      {controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.controlEn}
                    </p>
                    
                    {/* Required Evidence */}
                    <div className="mb-3">
                      <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                        Required Evidence:
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {controls.find((c: any) => c.eccControl.id === selectedControlId)?.eccControl.evidenceEn || 'Documentation, policies, procedures, and audit evidence'}
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
                            {controlLinkedEvidence.length} evidence linked - click to view
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs">No evidence linked</span>
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
                  Attach Evidence to Selected Control
                </h4>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => setUploadDialogOpen(true)}
                    disabled={!selectedControlId}
                    size="sm"
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload New File
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setLinkExistingDialogOpen(true)}
                    disabled={!selectedControlId}
                    size="sm"
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Link Existing File
                  </Button>
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
        </TabsContent>
      </Tabs>
      </div>
    </AppLayout>
  );
}