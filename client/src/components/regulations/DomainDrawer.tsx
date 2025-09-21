import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, CheckSquare, Square } from "lucide-react";
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

interface DomainDrawerProps {
  domainLabel: string;
  controls: Control[];
  language: 'en' | 'ar';
  selectedIds: Set<number>;
  onClose: () => void;
  onToggle: (id: number) => void;
  onBulk: (add: boolean) => void;
  onProceed?: () => void;
}

export function DomainDrawer({
  domainLabel,
  controls,
  language,
  selectedIds,
  onClose,
  onToggle,
  onBulk,
  onProceed
}: DomainDrawerProps) {
  const [trapFocus, setTrapFocus] = useState(false);
  
  // Focus trap setup
  useEffect(() => {
    setTrapFocus(true);
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // Calculate selection state
  const controlIds = controls.map(c => c.id);
  const selectedCount = controlIds.filter(id => selectedIds.has(id)).length;
  const allSelected = controlIds.length > 0 && controlIds.every(id => selectedIds.has(id));

  // Helper function to get evidence types
  const getEvidenceTypes = (evidenceTypes?: string[] | string | null): string[] => {
    if (!evidenceTypes) return [];
    if (typeof evidenceTypes === 'string') {
      return evidenceTypes.split(',').map(t => t.trim()).filter(Boolean);
    }
    return evidenceTypes;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
        onClick={onClose}
        data-testid="domain-drawer-backdrop"
      />
      
      {/* Drawer Panel */}
      <div 
        className="fixed right-0 top-0 h-full w-full sm:w-[540px] bg-white dark:bg-gray-900 shadow-2xl z-50 transition-transform duration-300 flex flex-col"
        data-testid="domain-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="drawer-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {domainLabel}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {language === 'ar' 
                  ? `${controls.length} ضابط متاح`
                  : `${controls.length} controls available`
                }
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full h-8 w-8 p-0"
              data-testid="close-drawer-button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulk(!allSelected)}
              className="flex items-center gap-2"
              data-testid="bulk-toggle-button"
            >
              {allSelected ? (
                <>
                  <Square className="h-4 w-4" />
                  {language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All'}
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4" />
                  {language === 'ar' ? 'تحديد الكل' : 'Select All'}
                </>
              )}
              <Badge variant="secondary" className="bg-white text-gray-600 border border-gray-200">
                {controls.length}
              </Badge>
            </Button>
            
            {selectedCount > 0 && (
              <Badge variant="default" className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
                {language === 'ar' ? `${selectedCount} محدد` : `${selectedCount} selected`}
              </Badge>
            )}
          </div>
        </div>

        {/* Controls List */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {controls.map((control) => {
              const isSelected = selectedIds.has(control.id);
              const evidenceTypes = getEvidenceTypes(control.evidenceTypes);
              
              return (
                <div
                  key={control.id}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    isSelected 
                      ? 'border-teal-300 bg-teal-50 dark:bg-teal-900/20 shadow-sm ring-1 ring-teal-200' 
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  data-testid={`control-item-${control.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle(control.id)}
                      className="mt-1 flex-shrink-0"
                      data-testid={`control-checkbox-${control.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {control.clauseNumber && (
                          <Badge variant="outline" className="text-xs">
                            {control.clauseNumber}
                          </Badge>
                        )}
                        {control.weight && (
                          <Badge variant="secondary" className="text-xs">
                            Weight: {control.weight}
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 leading-snug">
                        {language === 'ar' 
                          ? (control.controlAr || control.controlEn || 'Untitled Control')
                          : (control.controlEn || control.controlAr || 'Untitled Control')
                        }
                      </h4>
                      
                      {(control.descriptionEn || control.descriptionAr) && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2 leading-relaxed">
                          {language === 'ar' 
                            ? (control.descriptionAr || control.descriptionEn || '')
                            : (control.descriptionEn || control.descriptionAr || '')
                          }
                        </p>
                      )}
                      
                      {evidenceTypes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {evidenceTypes.map((type, index) => (
                            <Badge 
                              key={index} 
                              variant="outline" 
                              className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="sticky bottom-0 border-t dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'ar' ? 'المحدد:' : 'Selected:'}
              </span>
              <Badge variant="default" className="bg-teal-600">
                {selectedCount}
              </Badge>
            </div>
            
            {selectedCount > 0 && onProceed && (
              <Button 
                onClick={onProceed}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                data-testid="proceed-button"
              >
                {language === 'ar' ? 'إضافة للمشروع' : 'Add to Project'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}