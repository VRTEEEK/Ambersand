import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/hooks/use-i18n';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Shield } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

type Control = {
  id: number; 
  clauseNumber?: string|null;
  domainEn?: string|null; 
  domainAr?: string|null;
  subdomainEn?: string|null; 
  subdomainAr?: string|null;
  controlEn?: string|null; 
  controlAr?: string|null;
  descriptionEn?: string|null; 
  descriptionAr?: string|null;
  evidenceTypes?: string[]|string|null; 
  weight?: number|null;
};

type Regulation = {
  id: number;
  code: string;
  nameEn: string;
  nameAr?: string;
  version: string;
  status: string;
};

interface RegulationDetailProps {
  id?: number;
  inline?: boolean;
  onBack?: () => void;
}

export function RegulationDetail({ id: propId, inline = false, onBack }: RegulationDetailProps = {}) {
  const { id: paramId } = useParams();
  const [, navigate] = useLocation();
  const { language } = useI18n();
  const { can } = usePermissions();
  const { toast } = useToast();

  const [controls, setControls] = React.useState<Control[]>([]);
  const [regulation, setRegulation] = React.useState<Regulation | null>(null);
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [selectedDomain, setSelectedDomain] = React.useState<{label: string, items: Control[]} | null>(null);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const pageSize = 25;
  const [projectForm, setProjectForm] = React.useState({
    nameEn: '',
    nameAr: '',
    priority: 'Medium',
    owner: '',
    startDate: '',
    endDate: '',
    descriptionEn: '',
    descriptionAr: ''
  });
  const regId = propId ?? Number(paramId);

  // Fetch regulation info
  const { data: regulationsSummary } = useQuery({
    queryKey: ['/api/regulations/summary'],
    queryFn: async () => {
      const response = await fetch('/api/regulations/summary');
      if (!response.ok) throw new Error('Failed to fetch regulations summary');
      return response.json();
    },
  });

  // Fetch users for project owner dropdown
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Fetch regulation controls
  React.useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const r = await fetch(`/api/regulations/${regId}/controls`, {
          credentials: 'include',
          headers
        });
        if (!r.ok) {
          toast({ title: 'Failed to load regulation controls', variant: 'destructive' });
          return;
        }
        const data = await r.json();
        // normalize evidenceTypes
        setControls(data.map((c: any) => ({
          ...c,
          evidenceTypes: Array.isArray(c.evidenceTypes)
            ? c.evidenceTypes
            : (() => {
                try {
                  const parsed = JSON.parse(c.evidenceTypes || '[]');
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return String(c.evidenceTypes ?? '').split(',').map(s=>s.trim()).filter(Boolean);
                }
              })()
        })));
      } catch (error) {
        toast({ title: 'Error loading controls', variant: 'destructive' });
      }
    })();
  }, [regId]);

  // Set regulation info from summary data
  React.useEffect(() => {
    if (regulationsSummary) {
      const reg = regulationsSummary.find((r: any) => r.id === regId);
      if (reg) {
        setRegulation(reg);
      }
    }
  }, [regulationsSummary, regId]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return controls;
    return controls.filter(c => {
      const fields = [
        c.clauseNumber, c.controlEn, c.controlAr, c.descriptionEn, c.descriptionAr,
        c.domainEn, c.domainAr, c.subdomainEn, c.subdomainAr
      ];
      return fields.some(v => (v ?? '').toLowerCase().includes(qq));
    });
  }, [controls, q]);

  const groups = React.useMemo(() => {
    const map = new Map<string, {label:string, items:Control[]}>();
    for (const c of filtered) {
      // Priority: Arabic (if language is ar and exists) -> English -> Uncategorized
      const label = (language === 'ar' && c.domainAr) 
        ? c.domainAr 
        : (c.domainEn || (language === 'ar' ? 'غير مصنف' : 'Uncategorized'));
      const key = label.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(c);
    }
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label));
  }, [filtered, language]);

  // Reset page when domain or search changes
  React.useEffect(() => {
    setPage(1);
  }, [selectedDomain, q]);

  // Calculate pagination values for selected domain
  const totalItems = selectedDomain?.items.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedItems = selectedDomain?.items.slice(startIndex, endIndex) || [];

  const toggle = (id:number) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulk = (ids:number[], add:boolean) =>
    setSelected(s => { const n = new Set(s); ids.forEach(id => add ? n.add(id) : n.delete(id)); return n; });

  const handleFormChange = (field: string, value: string) => {
    setProjectForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateProject = async () => {
    if (!projectForm.nameEn.trim() || !projectForm.owner) {
      toast({ 
        title: language === 'ar' ? 'خطأ' : 'Error', 
        description: language === 'ar' ? 'يرجى ملء الحقول المطلوبة' : 'Please fill in required fields',
        variant: 'destructive' 
      });
      return;
    }

    const body = {
      name: projectForm.nameEn.trim(),
      nameAr: projectForm.nameAr.trim() || null,
      description: projectForm.descriptionEn.trim() || `Project created from ${selected.size} selected controls`,
      descriptionAr: projectForm.descriptionAr.trim() || null,
      priority: projectForm.priority,
      ownerId: projectForm.owner,
      startDate: projectForm.startDate || null,
      endDate: projectForm.endDate || null,
      regulationId: regId,
      controlIds: Array.from(selected)
    };

    try {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const r = await fetch('/api/projects', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      if (!r.ok) {
        const error = await r.text();
        toast({ title: 'Failed to create project', description: error, variant: 'destructive' });
        return;
      }
      
      const { id } = await r.json();
      toast({ title: 'Project created successfully' });
      setShowCreateDialog(false);
      setProjectForm({
        nameEn: '',
        nameAr: '',
        priority: 'Medium',
        owner: '',
        startDate: '',
        endDate: '',
        descriptionEn: '',
        descriptionAr: ''
      });
      setSelected(new Set());
      navigate(`/projects/${id}`);
    } catch (error) {
      toast({ title: 'Failed to create project', variant: 'destructive' });
    }
  };

  if (!regulation) {
    return (
      <div className="p-6 text-center">
        <div className="text-lg text-muted-foreground">Loading regulation...</div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Green Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6" />
            <h1 className="text-xl font-bold">
              {language === 'ar' ? 'ضوابط الأمن السيبراني الأساسية' : 'Essential Cybersecurity Controls'}
            </h1>
            {inline && onBack && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onBack}
                className="text-white hover:bg-white/20 ml-auto"
                data-testid="button-hide-details"
              >
                {language === 'ar' ? 'إخفاء التفاصيل' : 'Hide Details'}
              </Button>
            )}
          </div>
          
          {/* Search in header */}
          <div className="w-full max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-4 w-4" />
              <input
                type="text"
                placeholder={language === 'ar' ? 'البحث في الضوابط...' : 'Search controls...'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
                data-testid="input-search-controls"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className={inline ? "p-6" : "p-6 max-w-7xl mx-auto"}>

        {/* Non-inline back button */}
        {!inline && (
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => onBack ? onBack() : navigate('/regulations')} data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
              {language === 'ar' ? 'العودة للتنظيمات' : 'Back to Regulations'}
            </Button>
          </div>
        )}

        {!selectedDomain ? (
          <>
            <h2 className="text-xl font-semibold mb-4" data-testid="text-domains-title">
              {language === 'ar' ? 'المجالات الرئيسية' : 'Main Domains'}
            </h2>
          
          {/* Domains Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {groups.map(g => (
              <Card
                key={g.label}
                className="p-5 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 hover:border-slate-300"
                onClick={()=>setSelectedDomain(g)}
                data-testid={`card-domain-${g.label.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-lg" data-testid={`text-domain-${g.label.replace(/\s+/g, '-').toLowerCase()}`}>
                    {g.label}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const selectedInDomain = g.items.filter(item => selected.has(item.id)).length;
                      return selectedInDomain > 0 ? (
                        <Badge 
                          variant="default" 
                          className="bg-teal-600 hover:bg-teal-700 text-white"
                          data-testid={`badge-selected-${g.label.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {selectedInDomain}
                        </Badge>
                      ) : null;
                    })()}
                    <Badge variant="outline" data-testid={`badge-count-${g.label.replace(/\s+/g, '-').toLowerCase()}`}>
                      {g.items.length}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mb-3">
                  {language === 'ar' ? 'انقر لعرض الضوابط في هذا المجال' : 'Click to view controls under this domain'}
                </div>
                <div className="h-1 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full" />
              </Card>
            ))}
            </div>
          </>
        ) : (
          <>
            {/* Domain Controls View */}
            <div className="space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedDomain(null)}
                    className="text-slate-600 hover:text-slate-800"
                    data-testid="button-back-to-domains"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {language === 'ar' ? 'العودة للمجالات' : 'Back to Domains'}
                  </Button>
                  <span className="text-slate-400">{'>'}</span>
                  <span className="font-medium text-slate-700" data-testid="text-current-domain">
                    {selectedDomain.label}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const allSelected = selectedDomain.items.every(item => selected.has(item.id));
                    bulk(selectedDomain.items.map(item => item.id), !allSelected);
                  }}
                  className="bg-white hover:bg-slate-100"
                  data-testid="button-select-all"
                >
                  {(() => {
                    const allSelected = selectedDomain.items.every(item => selected.has(item.id));
                    return allSelected 
                      ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                      : (language === 'ar' ? 'تحديد الكل' : 'Select All');
                  })()} {selectedDomain.items.length}
                </Button>
              </div>
            
            {/* Controls List */}
            <div className="space-y-3">
              {pagedItems.map(control => {
                const isSelected = selected.has(control.id);
                return (
                  <HoverCard key={control.id}>
                    <HoverCardTrigger asChild>
                      <div 
                        className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        data-testid={`control-item-${control.id}`}
                      >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(control.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                      data-testid={`checkbox-control-${control.id}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {control.clauseNumber && (
                          <Badge 
                            variant="secondary" 
                            className="bg-teal-100 text-teal-700 border-teal-200"
                            data-testid={`badge-clause-${control.id}`}
                          >
                            {control.clauseNumber}
                          </Badge>
                        )}
                        <h4 className="font-medium text-slate-900" data-testid={`text-control-title-${control.id}`}>
                          {language === 'ar' && control.controlAr 
                            ? control.controlAr 
                            : control.controlEn || control.domainEn || `Control ${control.clauseNumber}`}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600 mb-2" data-testid={`text-control-description-${control.id}`}>
                        {((language === 'ar' && control.descriptionAr) ? control.descriptionAr : control.descriptionEn)
                         || ((language === 'ar' && control.subdomainAr) ? control.subdomainAr : control.subdomainEn)
                         || (language === 'ar' ? 'لا يوجد وصف' : 'No description available')}
                      </p>
                      <p className="text-xs text-slate-500" data-testid={`text-evidence-required-${control.id}`}>
                        {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'} 
                        {control.evidenceTypes && Array.isArray(control.evidenceTypes) && control.evidenceTypes.length > 0 
                          ? ` (${control.evidenceTypes.join(', ')})` 
                          : ` (${language === 'ar' ? 'غير محدد في قاعدة البيانات' : 'Not specified in database'})`}
                      </p>
                    </div>
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent 
                      className="w-80" 
                      side="right" 
                      data-testid={`hover-content-${control.id}`}
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {control.clauseNumber && (
                            <Badge variant="secondary" className="bg-teal-100 text-teal-700 border-teal-200">
                              {control.clauseNumber}
                            </Badge>
                          )}
                          <h4 className="font-semibold text-sm">
                            {language === 'ar' ? 'تفاصيل الضابط' : 'Control Details'}
                          </h4>
                        </div>
                        <div>
                          <h5 className="font-medium text-slate-900 mb-1">
                            {language === 'ar' && control.controlAr 
                              ? control.controlAr 
                              : control.controlEn || control.domainEn || `Control ${control.clauseNumber}`}
                          </h5>
                          <p className="text-sm text-slate-600 mb-2">
                            {((language === 'ar' && control.descriptionAr) ? control.descriptionAr : control.descriptionEn)
                             || ((language === 'ar' && control.subdomainAr) ? control.subdomainAr : control.subdomainEn)
                             || (language === 'ar' ? 'لا يوجد وصف' : 'No description available')}
                          </p>
                          <p className="text-xs text-slate-500">
                            <span className="font-medium">
                              {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'}
                            </span>{' '}
                            {control.evidenceTypes && Array.isArray(control.evidenceTypes) && control.evidenceTypes.length > 0 
                              ? control.evidenceTypes.join(', ') 
                              : (language === 'ar' ? 'غير محدد في قاعدة البيانات' : 'Not specified in database')}
                          </p>
                        </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setPage(Math.max(1, page - 1))}
                        className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        data-testid="pagination-previous"
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setPage(pageNum)}
                          isActive={page === pageNum}
                          className="cursor-pointer"
                          data-testid={`pagination-page-${pageNum}`}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        data-testid="pagination-next"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
            
            {/* Pagination Info */}
            {totalItems > 0 && (
              <div className="text-center text-sm text-slate-500 mt-2" data-testid="pagination-info">
                {language === 'ar' 
                  ? `عرض ${startIndex + 1}-${Math.min(endIndex, totalItems)} من ${totalItems} ضابط`
                  : `Showing ${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems} controls`}
              </div>
            )}
          </div>
          </>
        )}

        {/* Floating Create Project Button */}
        {selected.size > 0 && can('create_projects_from_regulations') && (
          <div className="fixed bottom-8 right-8 z-50">
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-floating-create-project"
            >
              <Plus className="h-5 w-5" />
              {language === 'ar' ? 'إنشاء مشروع' : 'Create Project'}
              <Badge variant="secondary" className="bg-white text-teal-600 ml-2">
                {selected.size}
              </Badge>
            </Button>
          </div>
        )}

        {/* Create Project Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {language === 'ar' ? 'إنشاء مشروع امتثال جديد' : 'Create New Compliance Project'}
              </DialogTitle>
              <DialogDescription>
                {language === 'ar' 
                  ? `إنشاء مشروع امتثال جديد مع ${selected.size} ضوابط محددة`
                  : `Create a new compliance project with ${selected.size} selected controls`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Project Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nameEn">
                    {language === 'ar' ? 'اسم المشروع (إنجليزي)' : 'Project Name (English)'}
                  </Label>
                  <Input
                    id="nameEn"
                    value={projectForm.nameEn}
                    onChange={(e) => handleFormChange('nameEn', e.target.value)}
                    placeholder={language === 'ar' ? 'تنفيذ ضوابط الأمن السيبراني الأساسية' : 'ECC Compliance Implementation'}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="nameAr">
                    {language === 'ar' ? 'اسم المشروع (عربي)' : 'Project Name (Arabic)'}
                  </Label>
                  <Input
                    id="nameAr"
                    value={projectForm.nameAr}
                    onChange={(e) => handleFormChange('nameAr', e.target.value)}
                    placeholder={language === 'ar' ? 'تطبيق ضوابط الأمن السيبراني الأساسية' : 'تطبيق ضوابط الأمن السيبراني الأساسية'}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Priority and Owner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">
                    {language === 'ar' ? 'الأولوية' : 'Priority'}
                  </Label>
                  <Select value={projectForm.priority} onValueChange={(value) => handleFormChange('priority', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">{language === 'ar' ? 'منخفضة' : 'Low'}</SelectItem>
                      <SelectItem value="Medium">{language === 'ar' ? 'متوسطة' : 'Medium'}</SelectItem>
                      <SelectItem value="High">{language === 'ar' ? 'عالية' : 'High'}</SelectItem>
                      <SelectItem value="Critical">{language === 'ar' ? 'حرجة' : 'Critical'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="owner">
                    {language === 'ar' ? 'مالك المشروع *' : 'Project Owner *'}
                  </Label>
                  <Select value={projectForm.owner} onValueChange={(value) => handleFormChange('owner', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={language === 'ar' ? 'اختر المالك...' : 'Select owner...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName || user.lastName 
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">
                    {language === 'ar' ? 'تاريخ البداية' : 'Start Date'}
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={projectForm.startDate}
                    onChange={(e) => handleFormChange('startDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">
                    {language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={projectForm.endDate}
                    onChange={(e) => handleFormChange('endDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="descriptionEn">
                    {language === 'ar' ? 'الوصف (إنجليزي)' : 'Description (English)'}
                  </Label>
                  <Textarea
                    id="descriptionEn"
                    value={projectForm.descriptionEn}
                    onChange={(e) => handleFormChange('descriptionEn', e.target.value)}
                    placeholder={language === 'ar' ? 'صف أهداف ونطاق المشروع...' : 'Describe the project goals and scope...'}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div>
                  <Label htmlFor="descriptionAr">
                    {language === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}
                  </Label>
                  <Textarea
                    id="descriptionAr"
                    value={projectForm.descriptionAr}
                    onChange={(e) => handleFormChange('descriptionAr', e.target.value)}
                    placeholder={language === 'ar' ? 'اشرح أهداف ونطاق المشروع...' : 'اشرح أهداف ونطاق المشروع...'}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>

              {/* Selected Controls */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded border-2 border-teal-600 bg-teal-600 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-sm"></div>
                  </div>
                  <h3 className="font-medium">
                    {language === 'ar' ? 'الضوابط المحددة' : 'Selected Controls'}
                  </h3>
                  <Badge variant="secondary">{selected.size}</Badge>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selected).map(controlId => {
                      const control = controls.find(c => c.id === controlId);
                      return (
                        <HoverCard key={controlId}>
                          <HoverCardTrigger asChild>
                            <div className="inline-block">
                              <Badge 
                                variant="outline" 
                                className="cursor-pointer bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100 transition-colors"
                                data-testid={`selected-control-badge-${controlId}`}
                              >
                                {control?.clauseNumber || controlId}
                                <button
                                  onClick={() => toggle(controlId)}
                                  className="ml-1 hover:text-red-600 transition-colors"
                                  aria-label="Remove control"
                                >
                                  ×
                                </button>
                              </Badge>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent 
                            className="w-80" 
                            side="top"
                            data-testid={`selected-hover-content-${controlId}`}
                            dir={language === 'ar' ? 'rtl' : 'ltr'}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {control?.clauseNumber && (
                                  <Badge variant="secondary" className="bg-teal-100 text-teal-700 border-teal-200">
                                    {control.clauseNumber}
                                  </Badge>
                                )}
                                <h4 className="font-semibold text-sm">
                                  {language === 'ar' ? 'تفاصيل الضابط' : 'Control Details'}
                                </h4>
                              </div>
                              <div>
                                <h5 className="font-medium text-slate-900 mb-1">
                                  {language === 'ar' && control?.controlAr 
                                    ? control.controlAr 
                                    : control?.controlEn || control?.domainEn || `Control ${control?.clauseNumber}`}
                                </h5>
                                <p className="text-sm text-slate-600 mb-2">
                                  {((language === 'ar' && control?.descriptionAr) ? control.descriptionAr : control?.descriptionEn)
                                   || ((language === 'ar' && control?.subdomainAr) ? control.subdomainAr : control?.subdomainEn)
                                   || (language === 'ar' ? 'لا يوجد وصف' : 'No description available')}
                                </p>
                                <p className="text-xs text-slate-500">
                                  <span className="font-medium">
                                    {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'}
                                  </span>{' '}
                                  {control?.evidenceTypes && Array.isArray(control.evidenceTypes) && control.evidenceTypes.length > 0 
                                    ? control.evidenceTypes.join(', ') 
                                    : (language === 'ar' ? 'غير محدد في قاعدة البيانات' : 'Not specified in database')}
                                </p>
                                <p className="text-xs text-slate-400 mt-2">
                                  {language === 'ar' ? 'انقر × للإزالة' : 'Click × to remove'}
                                </p>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Dialog Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                onClick={handleCreateProject}
                className="bg-teal-600 hover:bg-teal-700"
                disabled={!projectForm.nameEn.trim() || !projectForm.owner}
              >
                {language === 'ar' ? 'إنشاء مشروع' : 'Create Project'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}