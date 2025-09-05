import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Save, X, Calendar, User, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getRisk, updateRisk, getSeverityColor, getStatusColor, type RiskItem, type RiskStatus, type RiskSeverity } from "@/lib/api/risk";
import Comments from "@/components/comments/Comments";
import AssigneeSmartInput from "@/components/users/AssigneeSmartInput";

interface RiskDetailProps {
  riskId: number;
  onClose?: () => void;
}

export function RiskDetail({ riskId, onClose }: RiskDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<RiskItem>>({});

  const { data: risk, isLoading, error } = useQuery({
    queryKey: ["/api/risks", riskId],
    queryFn: () => getRisk(riskId),
  });

  // Initialize form data when risk loads
  useEffect(() => {
    if (risk) {
      setFormData({
        title: risk.title,
        riskDescription: risk.riskDescription || "",
        mitigationPlan: risk.mitigationPlan || "",
        status: risk.status,
        severity: risk.severity,
        assigneeId: risk.assigneeId,
      });
    }
  }, [risk]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<RiskItem>) => updateRisk(riskId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/risks", riskId] });
      setIsEditing(false);
      toast({
        title: "Risk Updated",
        description: "Risk details have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (risk) {
      setFormData({
        title: risk.title,
        riskDescription: risk.riskDescription || "",
        mitigationPlan: risk.mitigationPlan || "",
        status: risk.status,
        severity: risk.severity,
        assigneeId: risk.assigneeId,
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="text-center py-8 text-red-500">
        Failed to load risk details
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <AlertTriangle className="h-8 w-8 text-red-500 mt-1" />
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-2xl font-bold border-none px-0 shadow-none text-foreground"
                placeholder="Risk title..."
              />
            ) : (
              <h1 className="text-2xl font-bold">{risk.title}</h1>
            )}
            
            <div className="flex items-center space-x-3 mt-2">
              <Badge className={getSeverityColor(risk.severity)}>
                {risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)}
              </Badge>
              <Badge className={getStatusColor(risk.status)}>
                {risk.status.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
              <Link href={`/tasks/${risk.taskId}`} className="text-primary hover:underline text-sm flex items-center space-x-1">
                <ExternalLink className="h-3 w-3" />
                <span>View Task</span>
              </Link>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Edit Risk
            </Button>
          )}
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Risk Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Information */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status and Severity */}
              {isEditing ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => setFormData({ ...formData, status: value as RiskStatus })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-started">Not Started</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="mitigated">Mitigated</SelectItem>
                        <SelectItem value="under-review">Under Review</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Severity</label>
                    <Select 
                      value={formData.severity} 
                      onValueChange={(value) => setFormData({ ...formData, severity: value as RiskSeverity })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(risk.status)}>
                        {risk.status.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Severity</label>
                    <div className="mt-1">
                      <Badge className={getSeverityColor(risk.severity)}>
                        {risk.severity.charAt(0).toUpperCase() + risk.severity.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Description */}
              <div>
                <label className="text-sm font-medium mb-2 block">Risk Description</label>
                {isEditing ? (
                  <Textarea
                    value={formData.riskDescription || ""}
                    onChange={(e) => setFormData({ ...formData, riskDescription: e.target.value })}
                    placeholder="Describe the risk in detail..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm p-3 bg-muted rounded-md">
                    {risk.riskDescription || "No description provided"}
                  </p>
                )}
              </div>

              {/* Mitigation Plan */}
              <div>
                <label className="text-sm font-medium mb-2 block">Mitigation Plan</label>
                {isEditing ? (
                  <Textarea
                    value={formData.mitigationPlan || ""}
                    onChange={(e) => setFormData({ ...formData, mitigationPlan: e.target.value })}
                    placeholder="Describe the mitigation plan..."
                    rows={4}
                  />
                ) : (
                  <p className="text-sm p-3 bg-muted rounded-md">
                    {risk.mitigationPlan || "No mitigation plan provided"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs for Comments and Attachments */}
          <Tabs defaultValue="comments" className="w-full">
            <TabsList>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>
            <TabsContent value="comments">
              <Comments targetType="risk" targetId={risk.id} />
            </TabsContent>
            <TabsContent value="attachments">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    Attachment system integration coming soon
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Assignment</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <AssigneeSmartInput
                  onResolve={(result) => {
                    if (result.type === "existing") {
                      setFormData({ ...formData, assigneeId: result.userId });
                    }
                    // TODO: Handle invitations for new users
                  }}
                />
              ) : (
                <div>
                  {risk.assigneeId ? (
                    <p className="text-sm">Assigned to: {risk.assigneeId}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Unassigned</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p className="text-sm">{new Date(risk.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Updated</label>
                <p className="text-sm">{new Date(risk.updatedAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created By</label>
                <p className="text-sm">{risk.createdById}</p>
              </div>
              {risk.closedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Closed</label>
                  <p className="text-sm">{new Date(risk.closedAt).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}