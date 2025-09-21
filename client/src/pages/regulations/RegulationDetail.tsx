import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/hooks/use-i18n";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, X } from "lucide-react";
import { DomainGrid, Control } from "@/components/regulations/DomainGrid";
import { groupControlsByDomain, matchesQuery } from "@/utils/text";

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
  const { toast } = useToast();
  
  // Search functionality
  const { searchTerm, debouncedSearchTerm, setSearchTerm } = useDebouncedSearch('', 250);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Fetch regulation data
  const { data: regulation, isLoading: regulationLoading, error: regulationError } = useQuery({
    queryKey: ["regulation", Number(id)],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${id}`);
      if (!response.ok) throw new Error('Failed to fetch regulation');
      const data = await response.json();
      return data.regulation;
    },
    enabled: !!id,
  });

  // Fetch controls using the new endpoint
  const { data: controls = [], isLoading: controlsLoading } = useQuery({
    queryKey: ["regulation-controls", Number(id)],
    queryFn: async () => {
      const response = await fetch(`/api/regulations/${id}/controls`);
      if (!response.ok) throw new Error('Failed to fetch controls');
      return response.json();
    },
    enabled: !!id,
  });

  // Filter controls based on search
  const filteredControls = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return controls;
    return controls.filter((control: Control) => 
      matchesQuery(control, debouncedSearchTerm, language)
    );
  }, [controls, debouncedSearchTerm, language]);

  // Group filtered controls by domain
  const groupedControls = useMemo(() => {
    return groupControlsByDomain(filteredControls, language);
  }, [filteredControls, language]);

  // Handle control selection toggle
  const handleToggle = (controlId: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(controlId)) {
        newSet.delete(controlId);
      } else {
        newSet.add(controlId);
      }
      return newSet;
    });
  };

  // Handle bulk control addition
  const handleBulkAdd = (controlIds: number[]) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      controlIds.forEach(id => newSet.add(id));
      return newSet;
    });
  };

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Handle proceed action (placeholder for now)
  const handleProceed = () => {
    const selectedControlIds = Array.from(selectedIds);
    console.log('Proceeding with selected controls:', selectedControlIds);
    toast({ 
      title: "Feature Coming Soon", 
      description: `Selected ${selectedControlIds.length} controls for project creation.` 
    });
  };

  // Loading and error states
  if (regulationLoading || controlsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/regulations")}>
            <ArrowLeft className="h-4 w-4" />
            {language === 'ar' ? 'العودة للوائح' : 'Back to Regulations'}
          </Button>
          <div className="text-sm text-muted-foreground">
            {language === 'ar' ? 'جاري التحميل...' : 'Loading regulation...'}
          </div>
        </div>
      </div>
    );
  }
  
  if (regulationError || !regulation) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/regulations")}>
            <ArrowLeft className="h-4 w-4" />
            {language === 'ar' ? 'العودة للوائح' : 'Back to Regulations'}
          </Button>
          <div className="text-sm text-destructive">
            {language === 'ar' ? 'فشل في تحميل اللائحة' : 'Failed to load regulation.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/regulations")}>
                <ArrowLeft className="h-4 w-4" />
                {language === 'ar' ? 'العودة للوائح' : 'Back to Regulations'}
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {language === 'ar' && regulation.nameAr ? regulation.nameAr : regulation.nameEn}
                </h1>
                {regulation.nameAr && language === 'en' && (
                  <p className="text-sm text-muted-foreground">{regulation.nameAr}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{regulation.version}</Badge>
              <Badge variant={regulation.status === "active" ? "default" : "secondary"}>
                {regulation.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={language === 'ar' ? 'البحث في الضوابط...' : 'Search controls...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
              data-testid="search-input"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchTerm('')}
                data-testid="clear-search-button"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {debouncedSearchTerm && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {language === 'ar' 
                ? `البحث عن: "${debouncedSearchTerm}" - ${filteredControls.length} نتيجة`
                : `Searching for: "${debouncedSearchTerm}" - ${filteredControls.length} results`
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Domains Grid */}
      {groupedControls.size === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              {debouncedSearchTerm 
                ? (language === 'ar' ? 'لا توجد نتائج. جرب مصطلح بحث مختلف.' : 'No results. Try a different search term.')
                : (language === 'ar' ? 'لا توجد ضوابط لهذه اللائحة.' : 'No controls found for this regulation.')
              }
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {language === 'ar' ? 'المجالات الرئيسية' : 'Main Domains'}
            </h2>
            <Badge variant="outline" className="text-sm">
              {language === 'ar' 
                ? `${groupedControls.size} مجال` 
                : `${groupedControls.size} ${groupedControls.size === 1 ? 'domain' : 'domains'}`
              }
            </Badge>
          </div>
          
          <DomainGrid
            grouped={groupedControls}
            language={language}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onBulkAdd={handleBulkAdd}
            onProceed={handleProceed}
          />
        </div>
      )}

      {/* Global Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="shadow-2xl border-0 bg-white dark:bg-gray-900">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="bg-teal-600">
                  {language === 'ar' ? `${selectedIds.size} محدد` : `${selectedIds.size} selected`}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                  data-testid="clear-selection-button"
                >
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </Button>
                <Button
                  onClick={handleProceed}
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  data-testid="proceed-selection-button"
                >
                  {language === 'ar' ? 'إضافة للمشروع' : 'Add to Project'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}