import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { DomainDrawer } from "./DomainDrawer";

export interface Control {
  id: number;
  clauseNumber?: string | null;
  domainEn?: string | null;
  domainAr?: string | null;
  subdomainEn?: string | null;
  subdomainAr?: string | null;
  controlEn?: string | null;
  controlAr?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  evidenceTypes?: string[] | string | null;
  weight?: number | null;
}

interface DomainGridProps {
  grouped: Map<string, { label: string; controls: Control[] }>;
  language: 'en' | 'ar';
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onBulkAdd: (ids: number[]) => void;
  onProceed?: () => void;
}

export function DomainGrid({ 
  grouped, 
  language, 
  selectedIds, 
  onToggle, 
  onBulkAdd,
  onProceed 
}: DomainGridProps) {
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  const [openDomainData, setOpenDomainData] = useState<{ label: string; controls: Control[] } | null>(null);

  const handleOpenDomain = (domainKey: string) => {
    const domainData = grouped.get(domainKey);
    if (domainData) {
      setOpenDomain(domainKey);
      setOpenDomainData(domainData);
    }
  };

  const handleCloseDomain = () => {
    setOpenDomain(null);
    setOpenDomainData(null);
  };

  const handleBulkToggle = (domainControls: Control[], add: boolean) => {
    const controlIds = domainControls.map(c => c.id);
    if (add) {
      onBulkAdd(controlIds);
    } else {
      // Remove all controls from this domain
      controlIds.forEach(id => {
        if (selectedIds.has(id)) {
          onToggle(id);
        }
      });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from(grouped.entries()).map(([domainKey, { label, controls }]) => {
          const selectedCount = controls.filter(c => selectedIds.has(c.id)).length;
          const hasSelected = selectedCount > 0;
          
          return (
            <Card
              key={domainKey}
              className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 hover:scale-105 cursor-pointer rounded-2xl"
              onClick={() => handleOpenDomain(domainKey)}
              data-testid={`domain-card-${domainKey}`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <CardContent className="p-6 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors ${
                      hasSelected 
                        ? 'bg-teal-100 dark:bg-teal-900/30' 
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <Shield className={`h-5 w-5 ${
                        hasSelected 
                          ? 'text-teal-600 dark:text-teal-400' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex flex-col gap-1">
                      {hasSelected && (
                        <Badge 
                          variant="default" 
                          className="bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md text-xs"
                        >
                          {selectedCount} selected
                        </Badge>
                      )}
                      <Badge 
                        variant="outline" 
                        className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {controls.length}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-tight">
                  {label || 'Uncategorized'}
                </h3>
                
                <div className="mt-4 h-1 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full"></div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mt-3">
                  {language === 'ar' 
                    ? 'انقر لعرض الضوابط في هذا المجال' 
                    : 'Click to view controls under this domain'
                  }
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Domain Drawer */}
      {openDomain && openDomainData && (
        <DomainDrawer
          domainLabel={openDomainData.label}
          controls={openDomainData.controls}
          language={language}
          selectedIds={selectedIds}
          onClose={handleCloseDomain}
          onToggle={onToggle}
          onBulk={(add: boolean) => handleBulkToggle(openDomainData.controls, add)}
          onProceed={onProceed}
        />
      )}
    </>
  );
}