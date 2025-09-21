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
import { CreateProjectBar } from '@/components/regulations/CreateProjectBar';

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

  // Fetch regulation controls
  React.useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/regulations/${regId}/controls`);
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
            : String(c.evidenceTypes ?? '').split(',').map(s=>s.trim()).filter(Boolean)
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
      const label = (language === 'ar' ? c.domainAr : c.domainEn) || 'Uncategorized';
      const key = label.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(c);
    }
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label));
  }, [filtered, language]);

  const toggle = (id:number) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulk = (ids:number[], add:boolean) =>
    setSelected(s => { const n = new Set(s); ids.forEach(id => add ? n.add(id) : n.delete(id)); return n; });

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
                  <Badge variant="outline" data-testid={`badge-count-${g.label.replace(/\s+/g, '-').toLowerCase()}`}>
                    {g.items.length}
                  </Badge>
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
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'} {selectedDomain.items.length}
                </Button>
              </div>
            
            {/* Controls List */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {selectedDomain.items.map(control => {
                const isSelected = selected.has(control.id);
                return (
                  <div 
                    key={control.id} 
                    className="flex items-start gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
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
                          {language === 'ar' && control.controlAr ? control.controlAr : control.controlEn}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600 mb-2" data-testid={`text-control-description-${control.id}`}>
                        {(language === 'ar' && control.descriptionAr ? control.descriptionAr : control.descriptionEn) || 
                         (language === 'ar' ? 'لا يوجد وصف متاح' : 'No description available')}
                      </p>
                      <p className="text-xs text-slate-500" data-testid={`text-evidence-required-${control.id}`}>
                        {language === 'ar' ? 'الأدلة المطلوبة:' : 'Evidence Required:'} 
                        {control.evidenceTypes && Array.isArray(control.evidenceTypes) && control.evidenceTypes.length > 0 
                          ? ` (${control.evidenceTypes.join(', ')})` 
                          : ` (${language === 'ar' ? 'غير محدد' : 'Not specified'})`}
                      </p>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </>
        )}

        {/* Create Project Bar */}
      {selected.size > 0 && can('project:create') && (
        <CreateProjectBar
          count={selected.size}
          onClear={()=>setSelected(new Set())}
          onCreate={async (name: string, description?: string) => {
            const body = {
              name, 
              description, 
              regulationId: regId, 
              controlIds: Array.from(selected)
            };
            try {
              const r = await fetch('/api/projects', {
                method: 'POST', 
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify(body)
              });
              if (!r.ok) { 
                const error = await r.text();
                toast({ title: 'Failed to create project', description: error, variant: 'destructive' });
                return; 
              }
              const { id } = await r.json();
              toast({ title: 'Project created successfully' });
              navigate(`/projects/${id}`);
            } catch (error) {
              toast({ title: 'Failed to create project', variant: 'destructive' });
            }
          }}
          language={language}
          />
        )}
      </div>
    </div>
  );
}