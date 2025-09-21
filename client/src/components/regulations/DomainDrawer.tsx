import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X } from 'lucide-react';

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

interface DomainDrawerProps {
  domainLabel: string;
  items: Control[];
  selected: Set<number>;
  onClose: () => void;
  onToggle: (id: number) => void;
  onBulk: (add: boolean) => void;
  language: 'en' | 'ar';
}

export function DomainDrawer({ 
  domainLabel, 
  items, 
  selected, 
  onClose, 
  onToggle, 
  onBulk,
  language 
}: DomainDrawerProps) {
  const allSelected = items.length > 0 && items.every(item => selected.has(item.id));
  
  return (
    <div className="fixed inset-0 z-50 flex" data-testid="drawer-domain">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full sm:w-[520px] bg-white h-full shadow-2xl flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg" data-testid="text-domain-title">
                {domainLabel}
              </CardTitle>
              <CardDescription data-testid="text-controls-count">
                {language === 'ar' ? `${items.length} ضابط` : `${items.length} controls`}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <div className="p-4 border-b">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onBulk(true)}
              data-testid="button-select-all"
            >
              {language === 'ar' ? 'تحديد الكل' : 'Select all'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onBulk(false)}
              data-testid="button-deselect-all"
            >
              {language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect all'}
            </Button>
            <Badge variant="secondary" data-testid="badge-selected-count">
              {Array.from(selected).filter(id => items.some(item => item.id === id)).length} / {items.length}
            </Badge>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <CardContent className="p-4 space-y-3">
            {items.map(c => (
              <Card
                key={c.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                  selected.has(c.id) 
                    ? 'border-teal-300 bg-teal-50' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onToggle(c.id)}
                data-testid={`card-control-${c.id}`}
              >
                <div className="flex gap-3 items-start">
                  <Checkbox
                    checked={selected.has(c.id)}
                    onChange={() => onToggle(c.id)}
                    className="mt-1"
                    data-testid={`checkbox-control-${c.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {c.clauseNumber && (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-clause-${c.id}`}>
                          {c.clauseNumber}
                        </Badge>
                      )}
                    </div>
                    <div className="font-medium text-sm mb-1" data-testid={`text-control-title-${c.id}`}>
                      {language === 'ar' ? (c.controlAr || c.controlEn) : (c.controlEn || c.controlAr)}
                    </div>
                    <div className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-control-description-${c.id}`}>
                      {language === 'ar' ? (c.descriptionAr || c.descriptionEn || '') : (c.descriptionEn || c.descriptionAr || '')}
                    </div>
                    {(c.subdomainEn || c.subdomainAr) && (
                      <div className="text-xs text-muted-foreground mt-1" data-testid={`text-subdomain-${c.id}`}>
                        {language === 'ar' ? (c.subdomainAr || c.subdomainEn) : (c.subdomainEn || c.subdomainAr)}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </CardContent>
        </ScrollArea>
      </div>
    </div>
  );
}