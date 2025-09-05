import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { getRegulation, patchRegulation } from "@/lib/api/regulations";
import { useI18n } from "@/hooks/use-i18n";
import { usePermissions } from "@/hooks/use-permissions";
import { 
  Save, 
  Edit3, 
  CheckSquare, 
  Square, 
  FolderOpen, 
  FileText,
  Plus 
} from "lucide-react";
import { ControlEditorDialog } from "@/components/regulations/ControlEditorDialog";
import { ProjectCreateDialog } from "@/components/projects/ProjectCreateDialog";

interface Control {
  id: number;
  clause: string;
  mainCategoryEn: string;
  mainCategoryAr?: string;
  subCategoryEn: string;
  subCategoryAr?: string;
  mainControlEn: string;
  mainControlAr?: string;
  subControlEn?: string;
  subControlAr?: string;
  descriptionEn: string;
  descriptionAr?: string;
  evidenceTypes?: string;
  weight: number;
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

  // State for form data
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    nameEn: "",
    nameAr: "",
    version: "",
    publisher: "",
    status: "draft"
  });

  // State for control selection and filtering
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [selectedSubdomain, setSelectedSubdomain] = useState<string>("");
  const [selectedControls, setSelectedControls] = useState<Set<number>>(new Set());
  const [editingControl, setEditingControl] = useState<Control | null>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  // Fetch regulation data
  const { data, isLoading, error } = useQuery<{regulation: Regulation, controls: Control[]}>({
    queryKey: [`/api/regulations/${id}`],
    enabled: !!id,
    retry: false
  });

  const regulation: Regulation | undefined = data?.regulation;
  const controls: Control[] = data?.controls || [];

  // Update form data when regulation loads
  useEffect(() => {
    if (regulation) {
      setFormData({
        code: regulation.code || "",
        nameEn: regulation.nameEn || "",
        nameAr: regulation.nameAr || "",
        version: regulation.version || "",
        publisher: regulation.publisher || "",
        status: regulation.status || "draft"
      });
    }
  }, [regulation]);

  // Save regulation metadata mutation
  const saveRegulationMutation = useMutation({
    mutationFn: (data: any) => patchRegulation(Number(id), data),
    onSuccess: () => {
      toast({
        title: language === 'ar' ? 'تم الحفظ' : 'Saved',
        description: language === 'ar' ? 'تم حفظ التغييرات بنجاح' : 'Changes saved successfully',
      });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: [`/api/regulations/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: language === 'ar' ? 'فشل في حفظ التغييرات' : 'Failed to save changes',
        variant: 'destructive',
      });
    },
  });

  // Process controls for hierarchical display
  const domains = useMemo(() => {
    const domainMap = new Map();
    controls.forEach(control => {
      const domainKey = control.mainCategoryEn;
      if (!domainMap.has(domainKey)) {
        domainMap.set(domainKey, {
          nameEn: control.mainCategoryEn,
          nameAr: control.mainCategoryAr,
          subdomains: new Set()
        });
      }
      domainMap.get(domainKey).subdomains.add(JSON.stringify({
        nameEn: control.subCategoryEn,
        nameAr: control.subCategoryAr
      }));
    });

    return Array.from(domainMap.entries()).map(([key, value]) => ({
      nameEn: key,
      nameAr: value.nameAr,
      subdomains: Array.from(value.subdomains).map((sub: any) => JSON.parse(sub))
    }));
  }, [controls]);

  // Filtered subdomains based on selected domain
  const filteredSubdomains = useMemo(() => {
    if (!selectedDomain) return [];
    const domain = domains.find(d => d.nameEn === selectedDomain);
    return domain?.subdomains || [];
  }, [domains, selectedDomain]);

  // Filtered controls based on selected domain and subdomain
  const filteredControls = useMemo(() => {
    let filtered = controls;
    
    if (selectedDomain) {
      filtered = filtered.filter(c => c.mainCategoryEn === selectedDomain);
    }
    
    if (selectedSubdomain) {
      filtered = filtered.filter(c => c.subCategoryEn === selectedSubdomain);
    }
    
    return filtered.sort((a, b) => a.clause.localeCompare(b.clause));
  }, [controls, selectedDomain, selectedSubdomain]);

  // Handle form submission
  const handleSave = () => {
    saveRegulationMutation.mutate(formData);
  };

  // Handle control selection
  const toggleControl = (controlId: number) => {
    const newSelected = new Set(selectedControls);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setSelectedControls(newSelected);
  };

  // Handle select all in subdomain
  const selectAllInSubdomain = () => {
    const newSelected = new Set(selectedControls);
    filteredControls.forEach(control => {
      newSelected.add(control.id);
    });
    setSelectedControls(newSelected);
  };

  // Handle clear selection
  const clearSelection = () => {
    setSelectedControls(new Set());
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">
              {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !regulation) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'التنظيم غير موجود' : 'Regulation not found'}
          </p>
          <Button onClick={() => navigate('/regulations')} className="mt-4">
            {language === 'ar' ? 'العودة للائحة' : 'Back to Regulations'}
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Regulation Metadata Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl">
                  {language === 'ar' ? regulation.nameAr || regulation.nameEn : regulation.nameEn}
                </CardTitle>
                <Badge variant={regulation.status === 'active' ? 'default' : 'secondary'}>
                  {regulation.status === 'active' 
                    ? (language === 'ar' ? 'نشط' : 'Active')
                    : regulation.status === 'draft' 
                      ? (language === 'ar' ? 'مسودة' : 'Draft')
                      : (language === 'ar' ? 'مؤرشف' : 'Archived')
                  }
                </Badge>
              </div>
              
              {can('edit_regulations') && (
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={() => setEditMode(false)}
                        disabled={saveRegulationMutation.isPending}
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                      <Button 
                        onClick={handleSave}
                        disabled={saveRegulationMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'حفظ' : 'Save'}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setEditMode(true)}>
                      <Edit3 className="h-4 w-4 mr-2" />
                      {language === 'ar' ? 'تعديل' : 'Edit'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          
          {editMode && (
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">{language === 'ar' ? 'الكود' : 'Code'}</Label>
                  <Input 
                    id="code"
                    value={formData.code}
                    onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="version">{language === 'ar' ? 'الإصدار' : 'Version'}</Label>
                  <Input 
                    id="version"
                    value={formData.version}
                    onChange={e => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="nameEn">{language === 'ar' ? 'الاسم (إنجليزي)' : 'Name (English)'}</Label>
                  <Input 
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={e => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="nameAr">{language === 'ar' ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
                  <Input 
                    id="nameAr"
                    value={formData.nameAr}
                    onChange={e => setFormData(prev => ({ ...prev, nameAr: e.target.value }))}
                    dir="rtl"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="publisher">{language === 'ar' ? 'الناشر' : 'Publisher'}</Label>
                  <Input 
                    id="publisher"
                    value={formData.publisher}
                    onChange={e => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ECC-Style Control Selector */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {language === 'ar' ? 'محدد التحكم' : 'Control Selector'}
              </CardTitle>
              
              <div className="flex items-center gap-4">
                <Badge variant="outline">
                  {language === 'ar' ? `المحدد: ${selectedControls.size}` : `Selected: ${selectedControls.size}`}
                </Badge>
                
                {selectedControls.size > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      {language === 'ar' ? 'مسح التحديد' : 'Clear Selection'}
                    </Button>
                    
                    {can('create_projects') && (
                      <Button onClick={() => setShowProjectDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'إنشاء مشروع' : 'Create Project'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid lg:grid-cols-3 gap-4 h-96">
              {/* Domains Column */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {language === 'ar' ? 'المجالات' : 'Domains'}
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="h-80">
                  <div className="space-y-1 p-3">
                    {domains.map((domain) => (
                      <Button
                        key={domain.nameEn}
                        variant={selectedDomain === domain.nameEn ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => {
                          setSelectedDomain(domain.nameEn);
                          setSelectedSubdomain("");
                        }}
                      >
                        <span className="truncate">
                          {language === 'ar' ? domain.nameAr || domain.nameEn : domain.nameEn}
                        </span>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </Card>

              {/* Subdomains Column */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {language === 'ar' ? 'المجالات الفرعية' : 'Subdomains'}
                    </CardTitle>
                    {selectedDomain && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllInSubdomain}
                        disabled={!selectedSubdomain}
                      >
                        {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <ScrollArea className="h-80">
                  <div className="space-y-1 p-3">
                    {selectedDomain ? (
                      filteredSubdomains.map((subdomain) => (
                        <Button
                          key={subdomain.nameEn}
                          variant={selectedSubdomain === subdomain.nameEn ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => setSelectedSubdomain(subdomain.nameEn)}
                        >
                          <span className="truncate">
                            {language === 'ar' ? subdomain.nameAr || subdomain.nameEn : subdomain.nameEn}
                          </span>
                        </Button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">
                        {language === 'ar' ? 'اختر مجالاً أولاً' : 'Select a domain first'}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </Card>

              {/* Controls Column */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {language === 'ar' ? 'الضوابط' : 'Controls'}
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="h-80">
                  <div className="space-y-2 p-3">
                    {selectedDomain ? (
                      filteredControls.map((control) => (
                        <div
                          key={control.id}
                          className="flex items-start gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => toggleControl(control.id)}
                        >
                          <Checkbox
                            checked={selectedControls.has(control.id)}
                            onChange={() => toggleControl(control.id)}
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {control.clause}
                              </Badge>
                              {can('edit_regulations') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingControl(control);
                                  }}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            
                            <p className="text-sm font-medium truncate">
                              {language === 'ar' ? control.mainControlAr || control.mainControlEn : control.mainControlEn}
                            </p>
                            
                            {control.subControlEn && (
                              <p className="text-xs text-muted-foreground truncate">
                                {language === 'ar' ? control.subControlAr || control.subControlEn : control.subControlEn}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {language === 'ar' ? `الوزن: ${control.weight}` : `Weight: ${control.weight}`}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">
                        {language === 'ar' ? 'اختر مجالاً أولاً' : 'Select a domain first'}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Editor Dialog */}
      {editingControl && (
        <ControlEditorDialog
          control={editingControl}
          regulationId={Number(id)}
          open={!!editingControl}
          onClose={() => setEditingControl(null)}
          onSave={() => {
            setEditingControl(null);
            queryClient.invalidateQueries({ queryKey: [`/api/regulations/${id}`] });
          }}
        />
      )}

      {/* Project Create Dialog */}
      {showProjectDialog && (
        <ProjectCreateDialog
          regulationId={Number(id)}
          selectedControlIds={Array.from(selectedControls)}
          open={showProjectDialog}
          onClose={() => setShowProjectDialog(false)}
          onSuccess={() => {
            setShowProjectDialog(false);
            setSelectedControls(new Set());
          }}
        />
      )}
    </AppLayout>
  );
}