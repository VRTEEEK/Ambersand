import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Flag, Clock, FileText, Upload, Download, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

  // Get task controls
  const { data: controls = [] } = useQuery<ProjectControl[]>({
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Due Date:</span>
                    <span>{task.dueDate ? format(new Date(task.dueDate), "PPP") : "Not set"}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Assigned to:</span>
                    <span>{task.assignee?.email || "Unassigned"}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Created:</span>
                    <span>{task.createdAt ? format(new Date(task.createdAt), "PPP") : "Unknown"}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <span className="font-medium">Project:</span>
                    <span className="ml-2">{task.project?.name || "Unknown Project"}</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">Created by:</span>
                    <span className="ml-2">{task.createdBy?.email || "Unknown"}</span>
                  </div>
                  
                  {task.completedAt && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Completed:</span>
                      <span>{task.completedAt ? format(new Date(task.completedAt), "PPP") : "Unknown"}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {(task.description || task.descriptionAr) && (
                <div className="space-y-3">
                  <h3 className="font-medium">Description</h3>
                  {task.description && (
                    <p className="text-muted-foreground">{task.description}</p>
                  )}
                  {task.descriptionAr && (
                    <p className="text-muted-foreground" dir="rtl">{task.descriptionAr}</p>
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
                    <Card key={control.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary">
                              Control ID: {control.eccControlId}
                            </Badge>
                            <span className="font-medium">
                              ECC Control
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Control details will be loaded separately
                          </p>
                          <p className="text-sm">
                            This task is associated with control ID {control.eccControlId}
                          </p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidence">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Evidence ({evidence.length})</CardTitle>
              {canUploadEvidence && (
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Evidence
                    </Button>
                  </DialogTrigger>
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
              )}
            </CardHeader>
            <CardContent>
              {evidence.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No evidence uploaded yet</p>
                  {canUploadEvidence && (
                    <Button onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Evidence
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {evidence.map((item) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{item.title}</h4>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Uploaded: {item.createdAt ? format(new Date(item.createdAt), "PPP") : "Unknown"}</span>
                            {item.fileName && (
                              <span>File: {item.fileName}</span>
                            )}
                          </div>
                        </div>
                        {item.fileName && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={`/uploads/${item.fileName}`} download>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}