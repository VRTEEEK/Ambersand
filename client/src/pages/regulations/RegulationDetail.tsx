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
import { ArrowLeft, Search } from 'lucide-react';
import { DomainDrawer } from '@/components/regulations/DomainDrawer';
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

export function RegulationDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { language } = useI18n();
  const { can } = usePermissions();
  const { toast } = useToast();

  const [controls, setControls] = React.useState<Control[]>([]);
  const [regulation, setRegulation] = React.useState<Regulation | null>(null);
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [openDomain, setOpenDomain] = React.useState<string|null>(null);
  const regId = Number(id);

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/regulations')} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          {language === 'ar' ? 'العودة للتنظيمات' : 'Back to Regulations'}
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-regulation-title">
            {language === 'ar' && regulation.nameAr ? regulation.nameAr : regulation.nameEn}
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-regulation-code">
            {regulation.code} - {regulation.version}
          </p>
        </div>
        <Badge variant={regulation.status === 'active' ? 'default' : 'secondary'} data-testid="badge-status">
          {regulation.status}
        </Badge>
      </div>

      {/* Search and Language Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language==='ar'?'ابحث في الضوابط...':'Search controls…'}
            className="pl-10"
            value={q} 
            onChange={e=>setQ(e.target.value)}
            data-testid="input-search"
          />
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-4" data-testid="text-domains-title">
        {language === 'ar' ? 'المجالات الرئيسية' : 'Main Domains'}
      </h2>
      
      {/* Domains Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {groups.map(g => (
          <Card
            key={g.label}
            className="p-5 cursor-pointer hover:shadow-md transition-shadow border border-slate-200 hover:border-slate-300"
            onClick={()=>setOpenDomain(g.label)}
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

      {/* Domain Drawer */}
      {openDomain && (
        <DomainDrawer
          domainLabel={openDomain}
          items={groups.find(x=>x.label===openDomain)?.items || []}
          selected={selected}
          onClose={()=>setOpenDomain(null)}
          onToggle={toggle}
          onBulk={(add)=>bulk((groups.find(x=>x.label===openDomain)?.items||[]).map(i=>i.id), add)}
          language={language}
        />
      )}

      {/* Create Project Bar */}
      {selected.size > 0 && can('project:create') && (
        <CreateProjectBar
          count={selected.size}
          onClear={()=>setSelected(new Set())}
          onCreate={async (name, description) => {
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
  );
}