import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/hooks/use-i18n";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Edit,
  Plus,
  CheckCircle2,
  FileText,
  Settings
} from "lucide-react";
import { ControlEditorDialog } from "@/components/regulations/ControlEditorDialog";
import { ProjectCreateDialog } from "@/components/projects/ProjectCreateDialog";
import { getRegulation, getDomains, getSubdomains, patchControl } from "@/lib/api/regulations";
import { createProject } from "@/lib/api/projects";

interface Control {
  id: number;
  clause?: string;
  code?: string;
  
  // Unified regulation control fields
  mainCategoryEn?: string;
  mainCategoryAr?: string;
  subCategoryEn?: string;
  subCategoryAr?: string;
  mainControlEn?: string;
  mainControlAr?: string;
  subControlEn?: string;
  subControlAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  evidenceTypes?: string;
  weight?: number;
  
  // Custom regulation control fields
  mainDomain?: string;
  mainDomainAr?: string;
  subDomain?: string;
  subDomainAr?: string;
  control?: string;
  controlAr?: string;
  subControl?: string;
  description?: string;
  evidenceRequired?: boolean;
  evidenceNote?: string;
  evidenceNoteAr?: string;
  
  // Additional variant field names
  domain?: string;
  domainAr?: string;
  subdomain?: string;
  subdomainAr?: string;
}

interface Regulation {
  id: number;
  code: string;
  nameEn: string;
  nameAr?: string;
  version: string;
  publisher?: string;
  status: string;
  createdAt: string;
}

export function RegulationDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { language } = useI18n();
  const { can } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for filtering and selection
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedDomainEn, setSelectedDomainEn] = useState<string>("");
  const [selectedDomainAr, setSelectedDomainAr] = useState<string>("");
  const [selectedSubdomain, setSelectedSubdomain] = useState<string>("");
  const [selectedControlIds, setSelectedControlIds] = useState<number[]>([]);
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  // Fetch regulation data
  const { data, isLoading, error } = useQuery({
    queryKey: ["regulation", Number(id)],
    queryFn: () => getRegulation(Number(id!)),
    enabled: !!id,
  });
  const regulation = data?.regulation;
  const controls = data?.controls ?? [];

  // Fetch domains for filter pane
  const { data: domains = [] } = useQuery({
    queryKey: ["reg-domains", Number(id)],
    queryFn: () => getDomains(Number(id!)),
    enabled: !!id,
  });

  // Fetch subdomains when domain is selected
  const { data: subdomains = [] } = useQuery({
    queryKey: ["reg-subdomains", Number(id), selectedDomainEn, selectedDomainAr],
    queryFn: () => getSubdomains(Number(id!), { domainEn: selectedDomainEn, domainAr: selectedDomainAr }),
    enabled: !!selectedDomain && !!id,
  });

  // Filter controls based on selected domain/subdomain
  const filteredControls = useMemo(() => controls.filter((c: Control) => {
    const matchDomain = !selectedDomain || 
      c.mainCategoryEn === selectedDomain || 
      c.mainCategoryAr === selectedDomain ||
      c.mainDomain === selectedDomain ||
      c.mainDomainAr === selectedDomain ||
      c.domain === selectedDomain ||
      c.domainAr === selectedDomain;
    
    const matchSub = !selectedSubdomain || 
      c.subCategoryEn === selectedSubdomain || 
      c.subCategoryAr === selectedSubdomain ||
      c.subDomain === selectedSubdomain ||
      c.subDomainAr === selectedSubdomain ||
      c.subdomain === selectedSubdomain ||
      c.subdomainAr === selectedSubdomain;
    
    return matchDomain && matchSub;
  }), [controls, selectedDomain, selectedSubdomain]);

  // Control editing mutation
  const editControlMutation = useMutation({
    mutationFn: ({ controlId, data }: { controlId: number; data: any }) => 
      patchControl(regulation!.id, controlId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regulation", Number(id)] });
      queryClient.invalidateQueries({ queryKey: ["reg-domains", Number(id)] });
      queryClient.invalidateQueries({ queryKey: ["reg-subdomains", Number(id)] });
      setEditingControl(null);
      toast({ title: "Control updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Failed to update control", description: error.message, variant: "destructive" });
    }
  });

  // Project creation mutation
  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (data) => {
      toast({ title: "Project created successfully" });
      navigate(`/projects/${data.projectId}`);
    },
    onError: (error) => {
      toast({ title: "Failed to create project", description: error.message, variant: "destructive" });
    }
  });

  // Handle domain selection
  const handleDomainSelect = (domain: any) => {
    setSelectedDomain(domain.mainCategoryEn || domain.mainDomainEn || domain.domain || "");
    setSelectedDomainEn(domain.mainCategoryEn || domain.mainDomainEn || domain.domain || "");
    setSelectedDomainAr(domain.mainCategoryAr || domain.mainDomainAr || domain.domainAr || "");
    setSelectedSubdomain("");
  };

  // Handle subdomain selection
  const handleSubdomainSelect = (subdomain: any) => {
    setSelectedSubdomain(subdomain.subCategoryEn || subdomain.subDomainEn || subdomain.subdomain || "");
  };

  // Handle control selection
  const handleControlSelect = (controlId: number, checked: boolean) => {
    setSelectedControlIds(prev => 
      checked 
        ? [...prev, controlId]
        : prev.filter(id => id !== controlId)
    );
  };

  // Loading and error states
  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading regulation…</div>;
  if (error || !regulation) return <div className="p-4 text-sm text-destructive">Failed to load regulation.</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/regulations")}>
            <ArrowLeft className="h-4 w-4" />
            Back to Regulations
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{regulation.nameEn}</h1>
            {regulation.nameAr && <p className="text-sm text-muted-foreground">{regulation.nameAr}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{regulation.version}</Badge>
          <Badge variant={regulation.status === "active" ? "default" : "secondary"}>
            {regulation.status}
          </Badge>
        </div>
      </div>

      {/* Action Bar */}
      {selectedControlIds.length > 0 && can("project:create") && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedControlIds.length} control(s) selected
                </span>
                <Button onClick={() => setShowProjectDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project from Selected ({selectedControlIds.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Pane: Domain/Subdomain Filter */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filter Controls</CardTitle>
              <CardDescription>Select domain and subdomain to filter controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Domains */}
              <div>
                <h4 className="font-medium mb-2">Domains</h4>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    <Button
                      variant={!selectedDomain ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedDomain("");
                        setSelectedDomainEn("");
                        setSelectedDomainAr("");
                        setSelectedSubdomain("");
                      }}
                    >
                      All Domains
                    </Button>
                    {domains.map((domain: any, idx: number) => (
                      <Button
                        key={idx}
                        variant={selectedDomain === (domain.mainCategoryEn || domain.domain) ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => handleDomainSelect(domain)}
                      >
                        {language === "ar" ? 
                          (domain.mainCategoryAr || domain.domainAr || domain.mainCategoryEn || domain.domain) :
                          (domain.mainCategoryEn || domain.domain || domain.mainCategoryAr || domain.domainAr)
                        }
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Subdomains */}
              {selectedDomain && (
                <div>
                  <h4 className="font-medium mb-2">Subdomains</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-1">
                      <Button
                        variant={!selectedSubdomain ? "default" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => setSelectedSubdomain("")}
                      >
                        All Subdomains
                      </Button>
                      {subdomains.map((subdomain: any, idx: number) => (
                        <Button
                          key={idx}
                          variant={selectedSubdomain === (subdomain.subCategoryEn || subdomain.subdomain) ? "default" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => handleSubdomainSelect(subdomain)}
                        >
                          {language === "ar" ? 
                            (subdomain.subCategoryAr || subdomain.subdomainAr || subdomain.subCategoryEn || subdomain.subdomain) :
                            (subdomain.subCategoryEn || subdomain.subdomain || subdomain.subCategoryAr || subdomain.subdomainAr)
                          }
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane: Controls List */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Controls ({filteredControls.length})</span>
                {(selectedDomain || selectedSubdomain) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDomain("");
                      setSelectedDomainEn("");
                      setSelectedDomainAr("");
                      setSelectedSubdomain("");
                    }}
                  >
                    Show All Controls
                  </Button>
                )}
              </CardTitle>
              {(selectedDomain || selectedSubdomain) && (
                <CardDescription>
                  Filtered by: {selectedDomain && `Domain: ${selectedDomain}`}
                  {selectedDomain && selectedSubdomain && " | "}
                  {selectedSubdomain && `Subdomain: ${selectedSubdomain}`}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {filteredControls.map((control: Control) => (
                    <div key={control.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedControlIds.includes(control.id)}
                            onCheckedChange={(checked) => 
                              handleControlSelect(control.id, checked as boolean)
                            }
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {control.clause && (
                                <Badge variant="outline">{control.clause}</Badge>
                              )}
                              {control.code && (
                                <Badge variant="outline">{control.code}</Badge>
                              )}
                            </div>
                            <h4 className="font-medium">
                              {language === "ar" ? 
                                ((control as any).mainControlAr || (control as any).controlAr || (control as any).mainControlEn || (control as any).control) :
                                ((control as any).mainControlEn || (control as any).control || (control as any).mainControlAr || (control as any).controlAr)
                              }
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {language === "ar" ? 
                                (control.descriptionAr || control.descriptionEn || control.description) :
                                (control.descriptionEn || control.description || control.descriptionAr)
                              }
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {language === "ar" ? 
                                  (control.mainCategoryAr || control.mainDomainAr || control.domainAr || control.mainCategoryEn || control.mainDomain || control.domain) :
                                  (control.mainCategoryEn || control.mainDomain || control.domain || control.mainCategoryAr || control.mainDomainAr || control.domainAr)
                                }
                              </span>
                              <span>→</span>
                              <span>
                                {language === "ar" ? 
                                  (control.subCategoryAr || control.subDomainAr || control.subdomainAr || control.subCategoryEn || control.subDomain || control.subdomain) :
                                  (control.subCategoryEn || control.subDomain || control.subdomain || control.subCategoryAr || control.subDomainAr || control.subdomainAr)
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                        {can("regulation:edit") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingControl(control)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Control Editor Dialog */}
      {editingControl && (
        <ControlEditorDialog
          control={editingControl}
          open={!!editingControl}
          onClose={() => setEditingControl(null)}
          onSave={(data: any) => {
            editControlMutation.mutate({ controlId: editingControl.id, data });
          }}
          isLoading={editControlMutation.isPending}
        />
      )}

      {/* Project Create Dialog */}
      {showProjectDialog && (
        <ProjectCreateDialog
          open={showProjectDialog}
          onClose={() => setShowProjectDialog(false)}
          onSave={(data: any) => {
            createProjectMutation.mutate({
              ...data,
              regulationId: regulation.id,
              controlIds: selectedControlIds
            });
          }}
          isLoading={createProjectMutation.isPending}
          selectedControlsCount={selectedControlIds.length}
        />
      )}
    </div>
  );
}